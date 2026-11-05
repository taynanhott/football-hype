import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { createWorld, playNextBatch, recordEvent } from '@football/domain';
import { worldStateSchema } from '@football/shared';
import { DurableLeagueRepository, type SqlStore } from '../src/repository';

it('anexa somente jogos novos e recupera o mesmo histórico completo após reiniciar', async () => {
  const db = new DatabaseSync(':memory:');
  let resultWrites = 0;
  const sql: SqlStore = {
    exec<T>(query: string, ...values: (string | number | null | ArrayBuffer)[]) {
      if (query.startsWith('INSERT INTO chunks') && values[1] === 'results') resultWrites++;
      return db
        .prepare(query)
        .all(
          ...values.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)),
        ) as unknown as Iterable<T>;
    },
  };
  const atomic = <T>(fn: () => T) => {
    db.exec('BEGIN');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }) => {
    if (!r.ok) throw Error(JSON.stringify(r.error));
    return r.value;
  };
  const repo = new DurableLeagueRepository(sql, atomic, false);
  let state = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Append',
      mode: 'offline',
      now: 1,
    }),
  );
  try {
    await repo.create(state);
    for (let round = 0; round < 4; round++) {
      const previous = state;
      const next = unwrap(playNextBatch(state, round + 1));
      const event = unwrap(
        recordEvent(state, next, {
          id: crypto.randomUUID(),
          actorId: 'host',
          occurredAt: round + 1,
          type: 'round.played',
          message: 'Rodada',
          amount: 0,
        }),
      );
      state = { ...state, ...event.patch, revision: event.sequence };
      resultWrites = 0;
      await repo.append(state.id, previous.revision, state, event);
      const suffixSize = JSON.stringify(state.results.slice(previous.results.length)).length;
      expect(resultWrites).toBeLessThanOrEqual(Math.ceil(suffixSize / 32768) + 2);
      const rows = db
        .prepare('SELECT value FROM chunks WHERE league_id=? AND branch=? ORDER BY part')
        .all(state.id, 'results');
      expect(rows.map((row) => row.value).join('')).toBe(JSON.stringify(state.results));
      const reload = new DurableLeagueRepository(sql, atomic, false);
      const loaded = (await reload.load(state.id))!;
      expect(loaded.state).toEqual(worldStateSchema.parse(JSON.parse(JSON.stringify(state))));
      expect(JSON.stringify(loaded.state.results)).toBe(JSON.stringify(state.results));
    }
    const previous = state;
    const next = {
      ...state,
      results: state.results.map((result, index) =>
        index ? result : { ...result, homeGoals: result.homeGoals + 1 },
      ),
    };
    const event = unwrap(
      recordEvent(state, next, {
        id: crypto.randomUUID(),
        actorId: 'host',
        occurredAt: 5,
        type: 'round.played',
        message: 'Correção',
        amount: 0,
      }),
    );
    state = { ...state, ...event.patch, revision: event.sequence };
    await repo.append(state.id, previous.revision, state, event);
    expect((await new DurableLeagueRepository(sql, atomic, false).load(state.id))!.state).toEqual(
      worldStateSchema.parse(JSON.parse(JSON.stringify(state))),
    );
  } finally {
    db.close();
  }
});
