import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect } from 'vitest';
import { LeagueService } from '../../server/src/application/league-service.js';
import { DurableLeagueRepository, type SqlStore } from '../src/repository.js';
import { FileDataProvider } from '../../server/src/repositories/file-data-provider.js';
import { fileURLToPath } from 'node:url';

describe('Durable SQLite: atomicidade e recuperação', () => {
  it('mantém sorteios, patches, idempotência e recuperação com outra instância', async () => {
    const db = new DatabaseSync(':memory:');
    const sql: SqlStore = {
      exec<T>(query: string, ...values: (string | number | null | ArrayBuffer)[]) {
        return db
          .prepare(query)
          .all(
            ...values.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)),
          ) as unknown as Iterable<T>;
      },
    };
    const atomic = <T>(fn: () => T): T => {
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
    const repo = new DurableLeagueRepository(sql, atomic);
    const provider = new FileDataProvider(
      fileURLToPath(new URL('../../../data/player-database.json', import.meta.url)),
    );
    const service = new LeagueService(repo, () => Date.parse('2026-10-28T15:00:00Z'), provider);
    const user = { userId: 'durable-test-user', name: 'Treinador', guest: true };
    try {
      const soloId = await service.create(user, { mode: 'offline' });
      const soloReload = new DurableLeagueRepository(sql, atomic);
      expect((await soloReload.load(soloId))?.state.mode).toBe('offline');
      await repo.remove(soloId, user.userId, Date.now());
      const draw = await service.draw(user, { mode: 'multiplayer', division: 'A' });
      expect(await service.draw(user, { mode: 'multiplayer', division: 'B' })).toEqual(draw);
      const id = await service.create(user, { mode: 'multiplayer' });
      expect(await repo.getDraw(user.userId, 'multiplayer')).toBeUndefined();
      const before = (await repo.load(id))!;
      const requestId = crypto.randomUUID();
      const command = { type: 'admission', division: 'B', assignment: 'random' };
      const revision = await service.command(id, user.userId, command, false, requestId);
      expect(await service.command(id, user.userId, command, false, requestId)).toBe(revision);
      const saved = (await repo.load(id))!;
      const reload = new DurableLeagueRepository(sql, atomic);
      expect(await reload.load(id)).toEqual(saved);
      expect(
        (await reload.load(id, { eventPatches: false }))?.events.every(
          (e) => Object.keys(e.patch).length === 0,
        ),
      ).toBe(true);
      expect(
        db.prepare('SELECT max(length(value)) AS size FROM chunks').get()?.size,
      ).toBeLessThanOrEqual(32768);
      await expect(
        repo.append(id, before.state.revision, saved.state, saved.events.at(-1)!),
      ).rejects.toThrow();
      expect((await reload.load(id))?.state.revision).toBe(revision);
      expect((await repo.summariesForUser(user.userId))[0]?.id).toBe(id);
      await expect(repo.remove(id, 'intruder', Date.now())).rejects.toThrow();
      await repo.remove(id, user.userId, Date.now());
      expect(await reload.load(id)).toBeUndefined();
      expect(await repo.forUser(user.userId)).toEqual([]);
      expect(await repo.active()).not.toContain(id);
    } finally {
      db.close();
    }
  }, 30000);
});
