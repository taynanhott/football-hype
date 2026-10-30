import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { createWorld, applyEvent, executeCommand, nextRealMatchTime } from '@football/domain';
import {
  commandSchema,
  type GameCommand,
  type GameSnapshot,
  type WorldState,
} from '@football/shared';
import { ActionQueue } from '../../client/src/store/action-queue';
import { localTables } from '../../client/src/store/local-tables';
import { DurableLeagueRepository, type SqlStore } from '../src/repository.js';
import { LeagueService } from '../../server/src/application/league-service.js';
import { nextLeagueWake } from '../src/wake-policy.js';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};
const now = Date.parse('2026-10-30T11:00:00Z');
function world(): WorldState {
  const state = unwrap(
    createWorld({
      id: randomUUID(),
      userId: 'coach-0',
      name: 'Carga de dez jogadores',
      mode: 'multiplayer',
      now,
    }),
  );
  return {
    ...state,
    seasonClock: 1,
    inviteCode: randomUUID(),
    calendarAnchor: { realAt: now, gameAt: state.lastProcessedAt },
    nextScheduledAt: nextRealMatchTime(now),
    participants: state.clubs.ids
      .slice(0, 10)
      .map((clubId, i) => ({ userId: `coach-${i}`, clubId, ready: false, lastSeenAt: now })),
  };
}
const snap = (state: WorldState): GameSnapshot => ({
  state,
  tables: {},
  ledger: [],
  roomId: 'load',
  serverTime: now,
});

describe('orçamento de rede: dez jogadores', () => {
  it('envia os ajustes cinco segundos antes da partida e imediatamente antes do mercado', () => {
    vi.useFakeTimers();
    try {
      const initial = { ...world(), nextScheduledAt: now + 10000 };
      const sent: { id: string; command: GameCommand }[] = [];
      const queue = new ActionQueue(
        'coach-0',
        (id, command) => sent.push({ id, command }),
        () => {},
        (message) => {
          throw new Error(message);
        },
        [],
        () => {},
        30000,
      );
      queue.accept(snap(initial));
      queue.enqueue({ type: 'home-ticket-price', priceCents: 7500 }, randomUUID(), now);
      vi.advanceTimersByTime(4999);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(sent).toHaveLength(1);
      queue.stop();
      const marketQueue = new ActionQueue(
        'coach-0',
        (id, command) => sent.push({ id, command }),
        () => {},
        (message) => {
          throw new Error(message);
        },
        [],
        () => {},
        30000,
      );
      marketQueue.accept(snap(world()));
      marketQueue.enqueue({ type: 'home-ticket-price', priceCents: 5000 }, randomUUID(), now);
      const playerId = initial.clubs.byId[initial.participants[0]!.clubId]!.playerIds[0]!;
      marketQueue.enqueue(
        { type: 'management', action: 'policy', playerId, available: true },
        randomUUID(),
        now,
      );
      expect(sent).toHaveLength(2);
      expect(sent[1]!.command.type).toBe('home-ticket-price');
      marketQueue.stop();
    } finally {
      vi.useRealTimers();
    }
  });
  it('agrupa cem alterações locais por jogador em uma mensagem e mantém o estado autoritativo', () => {
    vi.useFakeTimers();
    try {
      const initial = world();
      let server = initial;
      let messages = 0;
      for (let i = 0; i < 10; i++) {
        let projected: GameSnapshot = snap(initial);
        let envelope: { id: string; command: GameCommand } | undefined;
        const queue = new ActionQueue(
          `coach-${i}`,
          (id, command) => {
            messages++;
            envelope = { id, command };
          },
          (view) => {
            projected = view.snapshot;
          },
          (error) => {
            throw new Error(error);
          },
          [],
          () => {},
          30000,
        );
        queue.accept(snap(server));
        for (let edit = 0; edit < 100; edit++)
          queue.enqueue(
            { type: 'home-ticket-price', priceCents: 2500 + (edit % 20) * 2500 },
            randomUUID(),
            now,
          );
        expect(envelope).toBeUndefined();
        expect(projected.state.homeTicketPrices?.[initial.participants[i]!.clubId]).toBe(50000);
        vi.advanceTimersByTime(30000);
        const { id, command } = envelope!;
        const event = unwrap(executeCommand(server, command, `coach-${i}`, now, id));
        server = unwrap(applyEvent(server, event));
        queue.acknowledge(id, server.revision);
        queue.accept({ ...snap(server), ledger: [event] });
        expect(projected.state.homeTicketPrices?.[initial.participants[i]!.clubId]).toBe(50000);
        expect(projected.state.revision).toBe(server.revision);
        queue.stop();
      }
      expect(messages).toBe(10); // 1,000 edits -> 10 requests: 99% reduction.
    } finally {
      vi.useRealTimers();
    }
  });
  it('sincroniza um lote atomicamente, rejeita mercado dentro dele e calcula tabelas locais iguais às do servidor', async () => {
    const initial = world();
    const commands: Extract<GameCommand, { type: 'club-settings' }>['commands'] = [
      { type: 'home-ticket-price', priceCents: 7500 },
      { type: 'financial-plan', transfer: 0, salaries: 0 },
    ];
    expect(
      commandSchema.safeParse({
        type: 'club-settings',
        commands: [{ type: 'offer', playerId: randomUUID(), fee: 0 }],
      }).success,
    ).toBe(false);
    const event = unwrap(
      executeCommand(initial, { type: 'club-settings', commands }, 'coach-0', now, randomUUID()),
    );
    expect(event.sequence).toBe(initial.revision + 1);
    const invalid = executeCommand(
      initial,
      {
        type: 'club-settings',
        commands: [commands[0]!, { type: 'ticket-price', fixtureId: 'missing', priceCents: 5000 }],
      },
      'coach-0',
      now,
      randomUUID(),
    );
    expect(invalid.ok).toBe(false);
    expect(initial.homeTicketPrices?.[initial.participants[0]!.clubId]).toBeUndefined();
  });
  it('mede quatro horas de presença e compara o trabalho periódico antigo com liga ociosa sem gravações', async () => {
    const db = new DatabaseSync(':memory:');
    let writes = 0,
      statements = 0,
      returnedRows = 0;
    const sql: SqlStore = {
      exec<T>(query: string, ...bindings: (string | number | null | ArrayBuffer)[]) {
        const before = Number(db.prepare('SELECT total_changes() AS n').get()!.n);
        const rows = db
          .prepare(query)
          .all(...bindings.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)));
        writes += Number(db.prepare('SELECT total_changes() AS n').get()!.n) - before;
        statements++;
        returnedRows += rows.length;
        return rows as unknown as Iterable<T>;
      },
    };
    const atomic = <T>(fn: () => T): T => {
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };
    let clock = now;
    const repo = new DurableLeagueRepository(sql, atomic);
    const service = new LeagueService(repo, () => clock);
    try {
      const initial = world();
      await repo.create(initial);
      const snapshot = await service.snapshot(initial.id, 'coach-0');
      expect(localTables(snapshot.state)).toEqual(snapshot.tables);
      writes = 0;
      statements = 0;
      returnedRows = 0;
      const start = performance.now();
      for (let minute = 1; minute <= 240; minute++) {
        clock = now + minute * 60000;
        for (let i = 0; i < 10; i++) await service.touch(initial.id, `coach-${i}`);
      }
      const old = {
        applicationMessages: 10 * 240 * 2,
        presenceRowsWritten: writes,
        sqlStatements: statements,
        returnedRows,
        elapsedMs: Math.round(performance.now() - start),
      };
      writes = 0;
      statements = 0;
      returnedRows = 0;
      const saved = await repo.load(initial.id, { eventPatches: false });
      for (let i = 0; i < 10; i++)
        await service.join(initial.id, { userId: `coach-${i}`, name: 'Treinador', guest: true });
      const current = {
        applicationPresenceMessages: 0,
        presenceRowsWritten: writes,
        joinSqlStatements: statements,
      };
      expect(writes).toBe(0);
      expect((await repo.load(initial.id, { eventPatches: false }))!.state.revision).toBe(
        saved!.state.revision,
      );
      const report = {
        scope: 'Local reproducible workload; not Cloudflare billing or production traffic',
        players: 10,
        hours: 4,
        oldPeriodicPresence: old,
        optimizedPresence: current,
        settings: { edits: 1000, messages: 10, reductionPercent: 99 },
        workersRequestsNote:
          'WebSocket messages are not individual HTTP Worker requests. Incoming DO messages have separate billing rules.',
        budgetNote: 'No guarantee for arbitrary actions, bot traffic, CPU, storage or SQL quotas.',
      };
      writeFileSync(
        new URL('../../../docs/network-benchmark.json', import.meta.url),
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(JSON.stringify(report));
    } finally {
      db.close();
    }
  }, 60000);
  it('agenda o próximo evento em vez de consultar a cada minuto e respeita o fim da partida', () => {
    const initial = world();
    const at = nextLeagueWake(initial, now)!;
    expect(at).toBeGreaterThan(now);
    expect(at).toBeLessThanOrEqual(initial.nextScheduledAt);
    const playing = {
      ...initial,
      nextScheduledAt: now - 1,
      results: [
        {
          fixtureId: 'live',
          homeId: initial.participants[0]!.clubId,
          awayId: initial.participants[1]!.clubId,
          startedAt: now,
          homeGoals: 0,
          awayGoals: 0,
        },
      ],
    } as WorldState;
    expect(nextLeagueWake(playing, now)).toBe(now + 90000);
    expect(nextLeagueWake({ ...initial, status: 'finished' }, now)).toBeUndefined();
  });
});
