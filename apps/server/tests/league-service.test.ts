import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';
import { IDS } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-10-26T15:00:00Z');
const host = { userId: IDS.user, name: 'Host', guest: true };
const guest = { userId: IDS.secondUser, name: 'Guest', guest: true };
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (dirname(directory) !== tmpdir()) throw new Error('Diretório de teste inválido');
    await rm(directory, { recursive: true, force: true });
  }
});

describe('serviço autoritativo de ligas', () => {
  it('serializa criação concorrente e permite apenas uma liga por modo', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const [first, second] = await Promise.all([
      service.create(host, { mode: 'offline' }),
      service.create(host, { mode: 'offline' }),
    ]);
    expect(first).toBe(second);
    await service.create(host, { mode: 'multiplayer' });
    expect(await service.list(host.userId)).toHaveLength(2);
    await expect(service.snapshot(first, guest.userId)).rejects.toThrow('Acesso negado');
    await expect(service.join(first, guest)).rejects.toThrow('Acesso negado');
    expect(await service.search(first, host.userId, 'Caio')).not.toHaveLength(0);
  });
  it('a maioria adianta a rodada e participantes desconectados mantêm seu clube', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const id = await service.create(host, { mode: 'multiplayer' });
    const own = (await service.snapshot(id, host.userId)).state.participants[0];
    if (!own) throw new Error('Clube ausente');
    await expect(service.join(id, guest, own.clubId)).rejects.toThrow('Acesso negado');
    const initial = (await service.snapshot(id, host.userId)).state;
    const available = initial.clubs.ids.find((clubId) => clubId !== own.clubId);
    await service.requestEntry(id, guest, { code: initial.inviteCode, clubId: available });
    await service.decide(id, host, { userId: guest.userId, approve: true });
    await service.join(id, guest);
    await service.join(id, guest);
    expect((await service.snapshot(id, host.userId)).state.participants).toHaveLength(2);
    await expect(service.command(id, guest.userId, { type: 'advance' })).rejects.toThrow('maioria');
    await service.command(id, host.userId, { type: 'ready', ready: true });
    expect((await service.snapshot(id, host.userId)).state.round).toBe(0);
    await service.command(id, guest.userId, { type: 'ready', ready: true });
    const snapshot = await service.snapshot(id, host.userId);
    expect(snapshot.state.round).toBe(1);
    expect(snapshot.state.participants.every((participant) => !participant.ready)).toBe(true);
    expect(snapshot.tables['serie-a']).toHaveLength(20);
    expect(snapshot.ledger).toHaveLength(5);
    await expect(
      service.command(id, host.userId, { type: 'hack', balance: 100 }),
    ).rejects.toThrow();
  });
  it('mantém estado e eventos após reiniciar o repositório local', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'football-'));
    directories.push(directory);
    const repository = new LocalLeagueRepository(directory);
    await repository.initialize();
    const service = new LeagueService(repository, () => now);
    const id = await service.create(host, { mode: 'offline' });
    await service.command(id, host.userId, { type: 'ready', ready: false });
    const expected = await service.snapshot(id, host.userId);
    const restored = new LocalLeagueRepository(directory);
    await restored.initialize();
    expect(await new LeagueService(restored, () => now).snapshot(id, host.userId)).toEqual(
      expected,
    );
    const saved = await repository.load(id);
    if (!saved?.events[0]) throw new Error('Evento ausente');
    await expect(repository.append(id, 0, saved.state, saved.events[0])).rejects.toThrow('mudou');
    await expect(repository.create(saved.state)).rejects.toThrow('já participa');
  });
  it('executa sem jogadores conectados, evita duplicação e recupera horários vencidos à noite', async () => {
    let clock = now;
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => clock);
    const id = await service.create(host, { mode: 'multiplayer' });
    await service.tick();
    expect((await service.snapshot(id, host.userId)).state.round).toBe(0);
    clock = (await service.snapshot(id, host.userId)).state.nextScheduledAt;
    await Promise.all([service.tick(), service.tick()]);
    expect((await service.snapshot(id, host.userId)).state.round).toBe(1);
    const first = (await service.snapshot(id, host.userId)).state;
    expect(first.results.every((result) => result.startedAt === clock)).toBe(true);
    clock = Date.parse('2026-10-27T04:00:00Z');
    await service.tick();
    const caughtUp = (await service.snapshot(id, host.userId)).state;
    expect(caughtUp.round).toBe(6);
    expect(caughtUp.nextScheduledAt).toBe(Date.parse('2026-10-27T11:00:00Z'));
    await service.tick();
    expect((await service.snapshot(id, host.userId)).state.round).toBe(caughtUp.round);
  });
});
