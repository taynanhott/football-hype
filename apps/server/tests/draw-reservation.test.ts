import { describe, expect, it } from 'vitest';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';

describe('reserva do sorteio', () => {
  it('reserva sem criar o mundo, mantém o clube e usa a reserva ao iniciar a carreira', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => Date.parse('2026-10-28T15:00:00Z'));
    const identity = { userId: 'draw-user', name: 'Técnico', guest: true };
    const first = await service.draw(identity, { mode: 'multiplayer', division: 'A' });
    expect(await repository.load(first.leagueId)).toBeUndefined();
    const retry = await service.draw(identity, { mode: 'multiplayer', division: 'B' });
    expect(retry).toEqual(first);
    const other = (await service.catalog()).clubs.find((club) => club.id !== first.clubId)!;
    const id = await service.create(identity, {
      name: 'Liga',
      mode: 'multiplayer',
      clubId: other.id,
      assignment: 'chosen',
    });
    expect(id).toBe(first.leagueId);
    expect((await repository.load(id))?.state.participants[0]?.clubId).toBe(first.clubId);
    await expect(service.draw(identity, { mode: 'multiplayer', division: 'A' })).rejects.toThrow(
      'já possui',
    );
    await service.leave(id, identity.userId, true);
    const next = await service.draw(identity, { mode: 'multiplayer', division: 'B' });
    expect(next.leagueId).not.toBe(first.leagueId);
    expect(next.division).toBe('B');
    const nextId = await service.create(identity, { name: 'Outra liga', mode: 'multiplayer' });
    await service.leave(nextId, identity.userId);
    expect(await repository.getDraw(identity.userId, 'multiplayer')).toBeUndefined();
  });
});
