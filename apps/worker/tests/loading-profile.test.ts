import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { it, expect } from 'vitest';
import {
  createWorld,
  importDataset,
  advanceGameDays,
  recordEvent,
  nextRealMatchTime,
  playNextBatch,
} from '@football/domain';
import {
  worldDatasetSchema,
  stateChanges,
  applyStateChanges,
  snapshotDeltaSchema,
  ledgerEntrySchema,
  gameSnapshotSchema,
  snapshotManifest,
  type WorldState,
  type GameSnapshot,
} from '@football/shared';
import { DurableLeagueRepository, type SqlStore } from '../src/repository';
import { LeagueService } from '../../server/src/application/league-service';
import { encodeSnapshotMessage } from '../src/snapshot-wire';
import { localTables } from '../../client/src/store/local-tables';

// Explicit diagnostic only: FOOTBALL_PROFILE_LOADING=1 pnpm exec vitest run --typecheck.enabled false apps/worker/tests/loading-profile.test.ts
it.skipIf(process.env.FOOTBALL_PROFILE_LOADING !== '1')(
  'mede o caminho de loading com a base real',
  async () => {
    const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
      if (!r.ok) throw new Error(JSON.stringify(r.error));
      return r.value;
    };
    const samples: Record<string, number[]> = {};
    const measure = async <T>(name: string, fn: () => T | Promise<T>): Promise<T> => {
      const start = performance.now();
      const result = await fn();
      (samples[name] ??= []).push(performance.now() - start);
      return result;
    };
    const dataset = worldDatasetSchema.parse(
      JSON.parse(
        readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
      ),
    );
    const now = Date.parse('2026-11-05T15:00:00Z');
    let state = unwrap(
      importDataset(
        unwrap(
          createWorld({
            id: randomUUID(),
            userId: 'profile',
            name: 'Profile',
            mode: 'multiplayer',
            now,
          }),
        ),
        dataset,
      ),
    );
    state = {
      ...state,
      seasonClock: 1,
      inviteCode: randomUUID(),
      calendarAnchor: { realAt: now, gameAt: state.lastProcessedAt },
      nextScheduledAt: nextRealMatchTime(now),
      participants: state.clubs.ids
        .filter((id) => state.clubs.byId[id]?.country === 'BR')
        .slice(0, 10)
        .map((clubId, i) => ({
          userId: i ? `profile-${i}` : 'profile',
          clubId,
          ready: false,
          lastSeenAt: now,
        })),
    };
    const db = new DatabaseSync(':memory:');
    let statements = 0,
      writtenBytes = 0,
      writeMs = 0;
    const sql: SqlStore = {
      exec<T>(query: string, ...bindings: (string | number | null | ArrayBuffer)[]) {
        statements++;
        if (query.startsWith('INSERT INTO chunks'))
          writtenBytes += Buffer.byteLength(String(bindings[3]));
        const before = performance.now();
        const rows = db
          .prepare(query)
          .all(...bindings.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)));
        writeMs += performance.now() - before;
        return rows as unknown as Iterable<T>;
      },
    };
    const atomic = <T>(fn: () => T): T => {
      db.exec('BEGIN');
      try {
        const value = fn();
        db.exec('COMMIT');
        return value;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    };
    const repo = new DurableLeagueRepository(sql, atomic, false);
    const service = new LeagueService(repo, () => now);
    const payloads: Record<string, unknown>[] = [];
    try {
      await repo.create(state);
      await service.snapshot(state.id, 'profile', 'cloudflare', false);
      state = (await repo.load(state.id, { eventPatches: false }))!.state;
      for (const scenario of ['daily', 'advance']) {
        for (let repeat = 0; repeat < 3; repeat++) {
          const before = state;
          const base = await service.snapshot(state.id, 'profile', 'cloudflare', false);
          const next = await measure(`${scenario}.domain`, () =>
            scenario === 'daily'
              ? advanceGameDays(before, before.lastProcessedAt + 86400000)
              : unwrap(playNextBatch(before, now)),
          );
          const event = await measure(`${scenario}.recordValidate`, () =>
            unwrap(
              recordEvent(before, next, {
                id: randomUUID(),
                actorId: 'profile',
                occurredAt: now,
                type: 'league.updated',
                message: 'profile',
                amount: 0,
              }),
            ),
          );
          const applied: WorldState = {
            ...before,
            ...event.patch,
            revision: event.sequence,
          } as WorldState;
          statements = 0;
          writtenBytes = 0;
          writeMs = 0;
          await measure(`${scenario}.persist`, () =>
            repo.append(state.id, before.revision, applied, event),
          );
          const persistence = {
            sqlStatements: statements,
            chunkWrittenBytes: writtenBytes,
            sqliteMs: writeMs,
          };
          const snapshots: GameSnapshot[] = [];
          await measure(`${scenario}.snapshot10`, async () => {
            for (const p of applied.participants)
              snapshots.push(await service.snapshot(state.id, p.userId, 'cloudflare', false));
          });
          const snapshot = snapshots[0]!;
          const coldRepo = new DurableLeagueRepository(sql, atomic, false);
          await measure(`${scenario}.coldLoad`, () =>
            coldRepo.load(state.id, { eventPatches: false }),
          );
          await measure(`${scenario}.cacheClone`, () => structuredClone(snapshot));
          await measure(`${scenario}.cacheManifest`, () =>
            snapshotManifest(snapshot, async (value) =>
              createHash('sha256').update(value).digest('hex'),
            ),
          );
          const changes = await measure(`${scenario}.diff`, () =>
            stateChanges(base.state, snapshot.state),
          );
          const delta = {
            leagueId: state.id,
            baseRevision: before.revision,
            revision: applied.revision,
            changes,
            tables: snapshot.tables,
            ledger: snapshot.ledger,
            serverTime: now,
            roomId: 'cloudflare',
          };
          const json = JSON.stringify({ type: 'snapshot-delta', data: delta });
          const deltaBranches: Record<string, { changes: number; bytes: number }> = {};
          for (const change of changes) {
            const key = change.path[0]!;
            const branch = (deltaBranches[key] ??= { changes: 0, bytes: 0 });
            branch.changes++;
            branch.bytes += Buffer.byteLength(JSON.stringify(change));
          }
          const wire = await measure(`${scenario}.encode`, () =>
            encodeSnapshotMessage('snapshot-delta', delta, true),
          );
          await measure(`${scenario}.fanout10`, async () => {
            for (const s of snapshots) {
              const diff = stateChanges(base.state, s.state);
              await encodeSnapshotMessage('snapshot-delta', { ...delta, changes: diff }, true);
            }
          });
          await measure(`${scenario}.fanout10SharedPreparation`, async () => {
            const diff = stateChanges(base.state, snapshots[0]!.state);
            const payload = await encodeSnapshotMessage(
              'snapshot-delta',
              { ...delta, changes: diff },
              true,
            );
            // The production flush reuses these bytes for equivalent bases/protocols.
            const messages = snapshots.map(() => payload);
            expect(messages).toHaveLength(10);
          });
          const decoded = await measure(`${scenario}.clientDecompress`, async () =>
            typeof wire === 'string'
              ? wire
              : new Response(
                  new Response(wire).body!.pipeThrough(new DecompressionStream('gzip')),
                ).text(),
          );
          const parsed = await measure(
            `${scenario}.clientJson`,
            () => JSON.parse(decoded) as { data: typeof delta },
          );
          const update = await measure(`${scenario}.clientValidateDelta`, () =>
            snapshotDeltaSchema.parse(parsed.data),
          );
          const client = await measure(`${scenario}.clientApply`, () =>
            applyStateChanges(base.state, update.changes),
          );
          await measure(`${scenario}.clientLedger`, () =>
            snapshot.ledger.map((entry) => ledgerEntrySchema.parse(entry)),
          );
          await measure(`${scenario}.clientTables`, () => localTables(client));
          await measure(`${scenario}.fullSnapshotValidate`, () =>
            gameSnapshotSchema.parse(snapshot),
          );
          const branchSizes = Object.fromEntries(
            Object.entries(event.patch).map(([key, value]) => [
              key,
              Buffer.byteLength(JSON.stringify(value) ?? ''),
            ]),
          );
          payloads.push({
            scenario,
            repeat,
            players: state.players.ids.length,
            clubs: state.clubs.ids.length,
            results: snapshot.state.results.length,
            ...persistence,
            changedBranches: branchSizes,
            deltaBranches,
            deltaChanges: changes.length,
            deltaJsonBytes: Buffer.byteLength(json),
            wireBytes: typeof wire === 'string' ? Buffer.byteLength(wire) : wire.byteLength,
          });
          expect(client.revision).toBe(applied.revision);
          state = applied;
        }
      }
      const report = {
        scope:
          'Local Node + SQLite in memory, real dataset, 10 connections, 3 sequential samples per scenario. No network, mobile render, Cloudflare CPU/billing or production latency measurement.',
        measurements: Object.fromEntries(
          Object.entries(samples).map(([name, values]) => [
            name,
            {
              medianMs: +[...values]
                .sort((a, b) => a - b)
                [Math.floor(values.length / 2)]!.toFixed(2),
              samplesMs: values.map((v) => +v.toFixed(2)),
            },
          ]),
        ),
        payloads,
      };
      writeFileSync(
        new URL('../../../docs/loading-profile.json', import.meta.url),
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(JSON.stringify(report.measurements));
    } finally {
      db.close();
    }
  },
  120000,
);
