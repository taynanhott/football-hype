import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createWorld, importDataset, nextRealMatchTime } from '@football/domain';
import { worldDatasetSchema, type WorldState } from '@football/shared';
import { DurableLeagueRepository, type SqlStore } from '../src/repository.js';
import { LeagueService } from '../../server/src/application/league-service.js';
import { nextLeagueWake } from '../src/wake-policy.js';

describe('temporada com a base real: um dia e dez treinadores', () => {
  it('processa o calendário sem polling e mantém margem nas cotas de 100 mil', async () => {
    const db = new DatabaseSync(':memory:');
    let writes = 0,
      queries = 0;
    const sql: SqlStore = {
      exec<T>(query: string, ...bindings: (string | number | null | ArrayBuffer)[]) {
        const before = Number(db.prepare('SELECT total_changes() AS n').get()!.n);
        const rows = db
          .prepare(query)
          .all(...bindings.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)));
        writes += Number(db.prepare('SELECT total_changes() AS n').get()!.n) - before;
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
    const start = Date.parse('2026-10-30T10:59:00Z');
    let clock = start;
    const service = new LeagueService(repo, () => clock);
    try {
      const generated = createWorld({
        id: randomUUID(),
        userId: 'coach-0',
        name: 'Carga real',
        mode: 'multiplayer',
        now: start,
      });
      if (!generated.ok) throw new Error('world');
      const dataset = worldDatasetSchema.parse(
        JSON.parse(
          readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
        ),
      );
      const imported = importDataset(generated.value, dataset);
      if (!imported.ok) throw new Error('dataset');
      const state: WorldState = {
        ...imported.value,
        seasonClock: 1,
        inviteCode: randomUUID(),
        calendarAnchor: { realAt: start, gameAt: imported.value.lastProcessedAt },
        nextScheduledAt: nextRealMatchTime(start),
        participants: imported.value.clubs.ids
          .filter((id) => imported.value.clubs.byId[id]?.country === 'BR')
          .slice(0, 10)
          .map((clubId, i) => ({ userId: `coach-${i}`, clubId, ready: false, lastSeenAt: start })),
      };
      await repo.create(state);
      await service.snapshot(state.id, 'coach-0', 'cloudflare', false);
      writes = 0;
      queries = 0;
      const wall = performance.now();
      let alarms = 0,
        matches = 0,
        maxTickMs = 0;
      for (let safety = 0; safety < 2000; safety++) {
        const current = (await repo.load(state.id, { eventPatches: false }))!.state;
        const next = nextLeagueWake(current, clock);
        if (next === undefined || next > start + 86400000) break;
        expect(next).toBeGreaterThan(clock);
        clock = next;
        const before = performance.now();
        await service.tick();
        maxTickMs = Math.max(maxTickMs, performance.now() - before);
        alarms++;
        const after = (await repo.load(state.id, { eventPatches: false }))!.state;
        matches += after.results.length - current.results.length;
        if (alarms >= 1500) throw new Error('Alarm loop');
      }
      const final = (await repo.load(state.id, { eventPatches: false }))!.state;
      const calendarWrites = writes;
      const calendarQueries = queries;
      const actionStart = performance.now();
      for (let i = 0; i < 10; i++) {
        const participant = final.participants[i]!;
        const playerId = final.clubs.byId[participant.clubId]!.playerIds[0]!;
        for (let edit = 0; edit < 100; edit++) {
          await service.command(
            state.id,
            participant.userId,
            {
              type: 'management',
              action: 'policy',
              playerId,
              available: edit % 2 === 0,
              rivals: false,
              interest: 35 + (edit % 30),
            },
            false,
            randomUUID(),
          );
        }
        for (let edit = 0; edit < 48; edit++)
          await service.command(
            state.id,
            participant.userId,
            { type: 'home-ticket-price', priceCents: 2500 + (edit % 20) * 2500 },
            false,
            randomUUID(),
          );
      }
      const reload = new DurableLeagueRepository(sql, atomic, false);
      const recovered = (await reload.load(state.id, { eventPatches: false }))!.state;
      expect(recovered.revision).toBe(final.revision + 1480);
      const report = {
        scope:
          'Local SQLite, production player dataset, virtual 24h. No Cloudflare CPU or billable usage claim.',
        players: 10,
        datasetPlayers: state.players.ids.length,
        calendarAlarms: alarms,
        matches,
        rowsWritten: writes,
        sqlStatements: queries,
        calendarRowsWritten: calendarWrites,
        calendarSqlStatements: calendarQueries,
        actionElapsedMs: Math.round(performance.now() - actionStart),
        elapsedMs: Math.round(performance.now() - wall),
        maxTickMs: Math.round(maxTickMs),
        finalRevision: recovered.revision,
        formerMinutePolling: 1440,
        alarmReductionPercent: Math.round((1 - alarms / 1440) * 10000) / 100,
        dailyScenario: {
          httpConnections: 10 * 27,
          marketMessages: 10 * 100,
          clubSettingBatches: 10 * 48,
          calendarAlarms: alarms,
          totalApplicationInvocations: 10 * 27 + 1000 + 480 + alarms,
          formerApplicationInvocations: 10 * 27 + 1000 + 480 + 28800 + 1440,
          reductionPercent:
            Math.round(
              (1 - (10 * 27 + 1000 + 480 + alarms) / (10 * 27 + 1000 + 480 + 28800 + 1440)) * 10000,
            ) / 100,
        },
      };
      writeFileSync(
        new URL('../../../docs/calendar-benchmark.json', import.meta.url),
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(JSON.stringify(report));
      expect(matches).toBeGreaterThan(0);
      expect(alarms).toBeLessThan(144);
      expect(10 * 27 + 10 * 100 + 10 * 48 + alarms).toBeLessThan(100000);
      expect(report.dailyScenario.reductionPercent).toBeGreaterThanOrEqual(90);
      expect(writes).toBeLessThan(100000);
    } finally {
      db.close();
    }
  }, 120000);
});
