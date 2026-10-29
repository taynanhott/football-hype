import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { LeagueService } from '../src/application/league-service.js';
import { PostgresLeagueRepository } from '../src/repositories/postgres-league-repository.js';

const url = process.env.POSTGRES_TEST_URL;
describe.skipIf(!url)('PostgreSQL real: persistência e concorrência', () => {
  const repository = new PostgresLeagueRepository(url ?? 'postgresql://localhost/test');
  const ids: string[] = [];
  const userId = `pg-test-${randomUUID()}`;
  afterAll(async () => {
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query('DELETE FROM football_draws WHERE user_id=$1', [userId]);
      await pool.query('DELETE FROM football_leagues WHERE id=ANY($1::text[])', [ids]);
    } finally {
      await pool.end();
      await repository.close();
    }
  });
  it('reserva uma vez, persiste patches, rejeita revisão antiga e libera exclusão', async () => {
    await repository.initialize();
    const service = new LeagueService(repository, () => Date.parse('2026-10-28T15:00:00Z'));
    const identity = { userId, name: 'Teste PostgreSQL', guest: true };
    const draws = await Promise.all([
      service.draw(identity, { mode: 'multiplayer', division: 'A' }),
      service.draw(identity, { mode: 'multiplayer', division: 'A' }),
    ]);
    expect(draws[0]).toEqual(draws[1]);
    const id = await service.create(identity, { mode: 'multiplayer' });
    ids.push(id);
    expect(await repository.getDraw(userId, 'multiplayer')).toBeUndefined();
    const before = (await repository.load(id))!;
    await service.command(id, userId, { type: 'admission', division: 'B', assignment: 'random' });
    const saved = (await repository.load(id))!;
    expect(saved.state.revision).toBeGreaterThan(before.state.revision);
    const second = new PostgresLeagueRepository(url!);
    try {
      expect(await second.load(id)).toEqual(saved);
    } finally {
      await second.close();
    }
    await expect(
      repository.append(id, before.state.revision, saved.state, saved.events.at(-1)!),
    ).rejects.toThrow();
    expect((await repository.summariesForUser(userId))[0]?.id).toBe(id);
    await repository.remove(id, userId, Date.now());
    expect(await repository.load(id)).toBeUndefined();
    expect(await repository.forUser(userId)).toEqual([]);
    expect(await repository.active()).not.toContain(id);
  });
});
