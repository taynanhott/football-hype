import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { it, expect } from 'vitest';
import { createWorld, importDataset, nextRealMatchTime, renewalTerms } from '@football/domain';
import { transferContext } from '../../../packages/domain/src/game/management.js';
import { worldDatasetSchema } from '@football/shared';
import { DurableLeagueRepository, type SqlStore } from '../src/repository.js';
import { LeagueService } from '../../server/src/application/league-service.js';
import { nextLeagueWake } from '../src/wake-policy.js';

// Opt in: this workload intentionally runs an entire season and is too expensive for routine tests.
it.skipIf(
  process.env.FULL_SEASON_BENCHMARK !== '1' && process.env.VALID_TRANSACTION_BENCHMARK !== '1',
)(
  'measures a complete season with ten active managers',
  async () => {
    const db = new DatabaseSync(':memory:');
    let writes = 0,
      returnedRows = 0,
      queries = 0;
    const sql: SqlStore = {
      exec<T>(query: string, ...bindings: (string | number | null | ArrayBuffer)[]) {
        const before = Number(db.prepare('SELECT total_changes() AS n').get()!.n);
        const rows = db
          .prepare(query)
          .all(...bindings.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)));
        writes += Number(db.prepare('SELECT total_changes() AS n').get()!.n) - before;
        returnedRows += rows.length;
        queries++;
        return rows as unknown as Iterable<T>;
      },
    };
    const atomic = <T>(fn: () => T): T => {
      db.exec('BEGIN');
      try {
        const r = fn();
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    };
    const repo = new DurableLeagueRepository(sql, atomic, false);
    const start = Date.parse('2026-10-31T10:59:00Z');
    let clock = start;
    const service = new LeagueService(repo, () => clock);
    const operations: Record<
      string,
      {
        count: number;
        errors: number;
        ms: number;
        cpuMicros: number;
        writes: number;
        returnedRows: number;
        bytes: number;
        errorExamples: string[];
      }
    > = {};
    const daily: Record<string, { writes: number; queries: number }> = {};
    async function measure(kind: string, fn: () => Promise<unknown>) {
      const m = (operations[kind] ??= {
        count: 0,
        errors: 0,
        ms: 0,
        cpuMicros: 0,
        writes: 0,
        returnedRows: 0,
        bytes: 0,
        errorExamples: [],
      });
      const w = writes,
        r = returnedRows,
        t = performance.now(),
        cpu = process.cpuUsage();
      m.count++;
      try {
        const result = await fn();
        m.bytes += Buffer.byteLength(JSON.stringify(result) ?? '');
        return result;
      } catch (e) {
        m.errors++;
        const message = String(e);
        if (m.errorExamples.length < 3 && !m.errorExamples.includes(message))
          m.errorExamples.push(message);
      } finally {
        const c = process.cpuUsage(cpu);
        m.cpuMicros += c.user + c.system;
        m.ms += performance.now() - t;
        m.writes += writes - w;
        m.returnedRows += returnedRows - r;
      }
    }
    const size = () =>
      Number(db.prepare('PRAGMA page_count').get()!.page_count) *
      Number(db.prepare('PRAGMA page_size').get()!.page_size);
    try {
      const generated = createWorld({
        id: randomUUID(),
        userId: 'coach-0',
        name: 'Full season resource audit',
        mode: 'multiplayer',
        now: start,
      });
      if (!generated.ok) throw new Error('createWorld');
      const dataset = worldDatasetSchema.parse(
        JSON.parse(
          readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
        ),
      );
      const imported = importDataset(generated.value, dataset);
      if (!imported.ok) throw new Error('dataset');
      const state = {
        ...imported.value,
        seasonClock: 1 as const,
        inviteCode: randomUUID(),
        calendarAnchor: { realAt: start, gameAt: imported.value.lastProcessedAt },
        nextScheduledAt: nextRealMatchTime(start),
        participants: imported.value.clubs.ids
          .filter((id) => imported.value.clubs.byId[id]?.country === 'BR')
          .slice(0, 10)
          .map((clubId, i) => ({ userId: `coach-${i}`, clubId, ready: false, lastSeenAt: start })),
      };
      if (process.env.VALID_TRANSACTION_BENCHMARK === '1') {
        // Synthetic financial headroom isolates successful transaction costs from refusals.
        state.clubs = {
          ...state.clubs,
          byId: Object.fromEntries(
            Object.entries(state.clubs.byId).map(([id, club]) => [
              id,
              { ...club, balance: { ...club.balance, cents: 100000000000 } },
            ]),
          ),
        };
      }
      await repo.create(state);
      await service.snapshot(state.id, 'coach-0', 'cloudflare', false);
      const initialBytes = size();
      if (process.env.VALID_TRANSACTION_BENCHMARK === '1') {
        const wall = performance.now();
        for (const p of state.participants) {
          await measure('budget', () =>
            service.command(
              state.id,
              p.userId,
              { type: 'financial-plan', transfer: 50000000000, salaries: 50000000000 },
              false,
              randomUUID(),
            ),
          );
          const current = (await repo.load(state.id, { eventPatches: false }))!.state;
          const candidates = current.clubs.byId[p.clubId]!.playerIds.map(
            (id) => current.players.byId[id]!,
          )
            .filter((player) => !renewalTerms(current, player).reason)
            .slice(0, 5);
          for (const player of candidates)
            await measure('renew', () =>
              service.command(
                state.id,
                p.userId,
                {
                  type: 'management',
                  action: 'renew',
                  playerId: player.id,
                  salary: renewalTerms(current, player).minimumSalary,
                  years: 1,
                },
                false,
                randomUUID(),
              ),
            );
        }
        const seller = state.participants[0]!;
        const current = (await repo.load(state.id, { eventPatches: false }))!.state;
        const target = current.clubs.byId[seller.clubId]!.playerIds.map(
          (id) => current.players.byId[id]!,
        ).sort((a, b) => a.overall - b.overall)[0]!;
        await measure('policy', () =>
          service.command(
            state.id,
            seller.userId,
            {
              type: 'management',
              action: 'policy',
              playerId: target.id,
              available: true,
              rivals: true,
              interest: 100,
            },
            false,
            randomUUID(),
          ),
        );
        for (let round = 0; round < 10; round++)
          for (const p of state.participants.slice(1)) {
            const current = (await repo.load(state.id, { eventPatches: false }))!.state;
            const terms = transferContext(
              current,
              current.players.byId[target.id]!,
              current.clubs.byId[p.clubId]!,
            );
            const competing = Math.max(
              0,
              ...current.negotiations.filter((n) => n.playerId === target.id).map((n) => n.fee),
            );
            await measure('competingOffer', () =>
              service.command(
                state.id,
                p.userId,
                {
                  type: 'offer',
                  playerId: target.id,
                  fee: Math.max(terms.minimumFee, competing) + 1000000,
                },
                false,
                randomUUID(),
              ),
            );
          }
        let completedTransfer = false;
        for (let step = 0; step < 60; step++) {
          const current = (await repo.load(state.id, { eventPatches: false }))!.state;
          const winner = current.negotiations.find(
            (n) => n.playerId === target.id && n.status === 'salary',
          );
          if (winner) {
            const buyer = current.participants.find((p) => p.clubId === winner.buyerId)!;
            await measure('salarySigning', () =>
              service.command(
                state.id,
                buyer.userId,
                {
                  type: 'salary',
                  negotiationId: winner.id,
                  salary: winner.minimumSalary ?? 1000000,
                },
                false,
                randomUUID(),
              ),
            );
            completedTransfer =
              (await repo.load(state.id, { eventPatches: false }))!.state.players.byId[target.id]!
                .clubId === buyer.clubId;
            break;
          }
          const next = nextLeagueWake(current, clock);
          if (next === undefined) break;
          clock = next;
          await measure('reviewCalendar', () => service.tick());
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        const report = {
          completedTransfer,
          scope:
            'Local real dataset, ten managers, synthetic cash headroom; renewals, repeated bids on one listed player, calendar review and salary signing. Not Cloudflare billing.',
          operations,
          writes,
          queries,
          returnedRows,
          initialBytes,
          finalBytes: size(),
          elapsedMs: performance.now() - wall,
        };
        writeFileSync(
          new URL('../../../docs/valid-transactions-resource-benchmark.json', import.meta.url),
          JSON.stringify(report, null, 2) + '\n',
        );
        expect(operations.renew!.count - operations.renew!.errors).toBeGreaterThan(0);
        expect(
          operations.competingOffer!.count - operations.competingOffer!.errors,
        ).toBeGreaterThan(0);
        expect(operations.salarySigning?.count).toBe(1);
        expect(operations.salarySigning?.errors).toBe(0);
        expect(completedTransfer).toBe(true);
        return;
      }
      const wall = performance.now();
      let alarms = 0,
        matches = 0;
      for (let safety = 0; safety < 2000; safety++) {
        const current = (await repo.load(state.id, { eventPatches: false }))!.state;
        if (current.status === 'finished') break;
        const next = nextLeagueWake(current, clock);
        if (next === undefined) throw new Error('No next wake before completion');
        expect(next).toBeGreaterThan(clock);
        clock = next;
        const dw = writes,
          dq = queries;
        await measure('calendar', () => service.tick());
        alarms++;
        const after = (await repo.load(state.id, { eventPatches: false }))!.state;
        const added = after.results.length - current.results.length;
        matches += added;
        if (added > 0 && after.status === 'active') {
          for (const p of after.participants) {
            const playerId = after.clubs.byId[p.clubId]!.playerIds[0]!;
            for (const query of ['a', 'an', 'and', 's', 'sa', 'san', 'm', 'ma', 'mar', ''])
              await measure('search', () => service.search(state.id, p.userId, query));
            await measure('ticket', () =>
              service.command(
                state.id,
                p.userId,
                { type: 'home-ticket-price', priceCents: 2500 + (alarms % 20) * 2500 },
                false,
                randomUUID(),
              ),
            );
            await measure('budget', () =>
              service.command(
                state.id,
                p.userId,
                { type: 'financial-plan', transfer: 100000000, salaries: 10000000 },
                false,
                randomUUID(),
              ),
            );
            await measure('renew', () =>
              service.command(
                state.id,
                p.userId,
                { type: 'management', action: 'renew', playerId, salary: 1000000, years: 3 },
                false,
                randomUUID(),
              ),
            );
            const target = after.players.ids.find(
              (id) => after.players.byId[id]?.clubId !== p.clubId,
            )!;
            await measure('offer', () =>
              service.command(
                state.id,
                p.userId,
                { type: 'offer', playerId: target, fee: 10000000 + alarms * 10000 },
                false,
                randomUUID(),
              ),
            );
            await measure('reconnectSnapshot', () =>
              service.snapshot(state.id, p.userId, 'cloudflare', false),
            );
          }
        }
        const day = (daily[new Date(clock).toISOString().slice(0, 10)] ??= {
          writes: 0,
          queries: 0,
        });
        day.writes += writes - dw;
        day.queries += queries - dq;
        // Let the runner deliver progress/heartbeats between batches of synchronous SQLite work.
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (alarms % 25 === 0)
          console.log(
            JSON.stringify({
              alarms,
              matches,
              clock: new Date(clock).toISOString(),
              status: after.status,
            }),
          );
      }
      const final = (await repo.load(state.id, { eventPatches: false }))!.state;
      const report = {
        scope:
          'Local SQLite full season. Local CPU is not Cloudflare CPU. Returned rows are not billed scanned rows. Full snapshots model reconnect payloads, not real sockets.',
        completed: final.status === 'finished',
        players: 10,
        datasetPlayers: state.players.ids.length,
        alarms,
        matches,
        virtualDays: (clock - start) / 86400000,
        operations,
        daily,
        writes,
        queries,
        returnedRows,
        initialBytes,
        finalBytes: size(),
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        elapsedMs: performance.now() - wall,
      };
      writeFileSync(
        new URL('../../../docs/full-season-resource-benchmark.json', import.meta.url),
        JSON.stringify(report, null, 2) + '\n',
      );
      expect(report.completed).toBe(true);
    } finally {
      db.close();
    }
  },
  3600000,
);
