import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
import {
  createWorld,
  playNextBatch,
  pendingFixtures,
  realFixtureTime,
  nextRealMatchTime,
} from '@football/domain';

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
  it('sorteia um administrador entre os restantes e exclui a liga após a última saída', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const id = await service.create(host, { mode: 'multiplayer' });
    const initial = await service.snapshot(id, host.userId);
    const code = initial.state.inviteCode!;
    const third = { userId: 'third-coach', name: 'Terceiro', guest: true };
    for (const identity of [guest, third]) {
      const clubId = (await service.invitation(id, { code }, identity.userId)).clubs.find(
        (club) => !club.occupied,
      )!.id;
      await service.requestEntry(id, identity, { code, clubId });
      await service.decide(id, host, { userId: identity.userId, approve: true, clubId });
    }
    await service.leave(id, host.userId);
    const remaining = (await service.snapshot(id, guest.userId)).state;
    expect([guest.userId, third.userId]).toContain(remaining.administratorId);
    const nextAdmin = remaining.administratorId;
    const lastUser = nextAdmin === guest.userId ? third.userId : guest.userId;
    await service.leave(id, nextAdmin);
    expect((await service.snapshot(id, lastUser)).state.administratorId).toBe(lastUser);
    await service.leave(id, lastUser);
    expect((await repository.load(id))?.state.deletedAt).toBe(now);
    expect(await service.list(lastUser)).toHaveLength(0);
    await expect(service.invitation(id, { code }, host.userId)).rejects.toThrow('Convite inválido');
  });
  it('não permite convites solo e acompanha presença por conexão ativa', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const solo = await service.create(host, { mode: 'offline' });
    expect((await service.snapshot(solo, host.userId)).state.inviteCode).toBeUndefined();
    await expect(service.invitation(solo, { code: 'qualquer' }, guest.userId)).rejects.toThrow(
      'Convite inválido',
    );
    const online = await service.create(host, { mode: 'multiplayer' });
    const presence = async () =>
      (await service.snapshot(online, host.userId)).state.participants[0]?.online;
    expect(await presence()).toBe(false);
    service.setOnline(online, host.userId, 'one', true);
    service.setOnline(online, host.userId, 'two', true);
    expect(await presence()).toBe(true);
    service.setOnline(online, host.userId, 'one', false);
    expect(await presence()).toBe(true);
    service.setOnline(online, host.userId, 'two', false);
    expect(await presence()).toBe(false);
  });
  it('sorteia somente o último clube livre e rejeita escolha de clube ocupado', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const world = unwrap(
      createWorld({
        id: IDS.league,
        userId: host.userId,
        name: 'Sorteio',
        mode: 'multiplayer',
        now,
      }),
    );
    const clubs = world.clubs.ids.filter((id) => world.clubs.byId[id]?.country === 'BR');
    const freeClub = clubs.at(-1)!;
    world.participants = clubs.slice(0, -1).map((clubId, index) => ({
      userId: index === 0 ? host.userId : `coach-${index}`,
      clubId,
      ready: false,
      lastSeenAt: now,
    }));
    world.inviteCode = 'test-invite';
    world.admission = { assignment: 'chosen', division: null };
    await repository.create(world);
    await expect(
      service.requestEntry(world.id, guest, { code: 'test-invite', clubId: clubs[0] }),
    ).rejects.toThrow('indisponível');
    const saved = (await repository.load(world.id))!.state;
    await service.command(world.id, host.userId, {
      type: 'admission',
      division: null,
      assignment: 'random',
    });
    await service.requestEntry(world.id, guest, { code: saved.inviteCode });
    await service.decide(world.id, host, { userId: guest.userId, approve: true });
    expect(
      (await service.snapshot(world.id, guest.userId)).state.participants.find(
        (member) => member.userId === guest.userId,
      )?.clubId,
    ).toBe(freeClub);
  });
  it('permite sortear a segunda carreira solo sem reutilizar a primeira reserva', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const firstDraw = await service.draw(host, { mode: 'offline', division: 'A' });
    const first = await service.create(host, {
      mode: 'offline',
      assignment: 'chosen',
      clubId: firstDraw.clubId,
    });
    const secondDraw = await service.draw(host, { mode: 'offline', division: 'A' });
    expect(secondDraw.leagueId).not.toBe(first);
    const second = await service.create(host, {
      mode: 'offline',
      assignment: 'chosen',
      clubId: secondDraw.clubId,
    });
    expect(second).not.toBe(first);
    expect(await service.list(host.userId)).toHaveLength(2);
    await expect(service.draw(host, { mode: 'offline', division: 'A' })).rejects.toThrow();
  });
  it('reserva o clube na saída online e libera a troca apenas após expulsão', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const id = await service.create(host, { mode: 'multiplayer' });
    const initial = await service.snapshot(id, host.userId);
    const oldClub = initial.state.participants[0]!.clubId;
    const otherClub = initial.state.clubs.ids.find((clubId) => clubId !== oldClub)!;
    const code = initial.state.inviteCode!;
    await service.requestEntry(id, guest, { code, clubId: otherClub });
    await service.decide(id, host, { userId: guest.userId, approve: true, clubId: otherClub });
    await service.leave(id, guest.userId, true);
    const preview = await service.invitation(id, { code }, guest.userId);
    expect(preview.clubs.map((club) => club.id)).toEqual([otherClub]);
    expect(
      (await service.invitation(id, { code }, host.userId)).clubs.find(
        (club) => club.id === otherClub,
      )?.occupied,
    ).toBe(true);
    expect(await service.requestEntry(id, guest, { code, clubId: oldClub })).toEqual({
      rejoined: true,
    });
    expect(
      (await service.snapshot(id, guest.userId)).state.participants.find(
        (member) => member.userId === guest.userId,
      )?.clubId,
    ).toBe(otherClub);
    await service.leave(id, guest.userId);
    await expect(service.kick(id, guest.userId, { userId: host.userId })).rejects.toThrow(
      'Acesso negado',
    );
    await service.kick(id, host.userId, { userId: guest.userId });
    expect((await service.invitation(id, { code }, guest.userId)).clubs.length).toBeGreaterThan(1);
  });
  it('reseta somente a carreira escolhida, mantém o clube e protege a administração', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const first = await service.create(host, { mode: 'offline' });
    const second = await service.create(host, { mode: 'offline' });
    const before = await service.snapshot(first, host.userId);
    const other = await service.snapshot(second, host.userId);
    await service.command(first, host.userId, { type: 'ready', ready: false });
    await expect(service.reset(first, guest.userId)).rejects.toThrow('administrador');
    await service.reset(first, host.userId);
    const reset = await service.snapshot(first, host.userId);
    expect(reset.state.round).toBe(before.state.round);
    expect(reset.state.participants[0]?.clubId).toBe(before.state.participants[0]?.clubId);
    expect(reset.state.results).toHaveLength(0);
    expect(reset.ledger).toHaveLength(0);
    expect((await service.snapshot(second, host.userId)).state).toEqual(other.state);
    await service.leave(first, host.userId, true);
    expect(await service.list(host.userId)).toHaveLength(1);
    await expect(service.create(host, { mode: 'offline' })).resolves.toBeTypeOf('string');
  });
  it('antecipa a rodada e o calendário para todos os treinadores e desloca o próximo jogo', async () => {
    const clock = Date.parse('2026-10-28T07:00:00-03:00');
    const repository = new LocalLeagueRepository(undefined);
    const state = unwrap(
      createWorld({
        id: IDS.league,
        userId: host.userId,
        name: 'Global',
        mode: 'multiplayer',
        now: clock,
      }),
    );
    const clubId = state.clubs.ids.find((id) => id !== state.participants[0]!.clubId)!;
    state.participants = [
      ...state.participants,
      { userId: guest.userId, clubId, ready: false, lastSeenAt: clock },
    ];
    state.calendarAnchor = { realAt: clock, gameAt: state.lastProcessedAt };
    await repository.create(state);
    const service = new LeagueService(repository, () => clock);
    await service.command(state.id, host.userId, { type: 'advance' });
    const first = await service.snapshot(state.id, host.userId);
    const second = await service.snapshot(state.id, guest.userId);
    expect(first.state).toEqual(second.state);
    expect(first.state.round).toBe(1);
    expect(first.state.lastProcessedAt).toBeGreaterThan(state.lastProcessedAt);
    expect(first.state.nextScheduledAt).toBe(state.nextScheduledAt);
  });
  it('processa dias antes do horário real do jogo sem disputar a rodada antecipadamente', async () => {
    let clock = Date.parse('2026-10-28T07:00:00-03:00');
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => clock);
    const id = await service.create(host, { mode: 'offline' });
    const before = (await repository.load(id))!.state;
    before.fixtures = before.fixtures.map((fixture) => ({
      ...fixture,
      scheduledAt: fixture.scheduledAt + 14 * 86400000,
    }));
    before.cups = [];
    clock += (before.nextScheduledAt - clock) / 2;
    await service.tick();
    const advanced = (await repository.load(id))!.state;
    expect(advanced.lastProcessedAt).toBeGreaterThan(before.lastProcessedAt);
    expect(advanced.lastProcessedAt).toBeLessThan(pendingFixtures(before)[0]!.scheduledAt);
    expect(advanced.round).toBe(0);
    expect(advanced.results).toHaveLength(0);
    await service.tick();
    expect((await repository.load(id))!.state.revision).toBe(advanced.revision);
  });
  it('reconhece uma ação reenviada após reconectar sem aplicá-la novamente', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const id = await service.create(host, { mode: 'offline' });
    const requestId = '00000001-0000-4000-8000-000000000099';
    const first = await service.command(
      id,
      host.userId,
      { type: 'home-ticket-price', priceCents: 5000 },
      false,
      requestId,
    );
    const retry = await service.command(
      id,
      host.userId,
      { type: 'home-ticket-price', priceCents: 7500 },
      false,
      requestId,
    );
    expect(retry).toBe(first);
    const saved = (await repository.load(id))!;
    expect(saved.events.filter((event) => event.id === requestId)).toHaveLength(1);
    expect(saved.state.homeTicketPrices?.[saved.state.participants[0]!.clubId]).toBe(5000);
  });
  it('serializa criação concorrente e permite duas solos e uma multiplayer', async () => {
    const repository = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repository, () => now);
    const [first, second] = await Promise.all([
      service.create(host, { mode: 'offline' }),
      service.create(host, { mode: 'offline' }),
    ]);
    expect(first).not.toBe(second);
    await service.create(host, { mode: 'multiplayer' });
    expect(await service.list(host.userId)).toHaveLength(3);
    await expect(service.create(host, { mode: 'offline' })).rejects.toThrow('Limite');
    await expect(service.create(host, { mode: 'multiplayer' })).rejects.toThrow('Limite');
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
  it.each(['offline', 'multiplayer'] as const)(
    'executa %s sem jogadores conectados, evita duplicação e recupera horários vencidos à noite',
    async (mode) => {
      let clock = now;
      const repository = new LocalLeagueRepository(undefined);
      const service = new LeagueService(repository, () => clock);
      const id = await service.create(host, { mode });
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
    },
  );
  it.each(['snapshot', 'tick'] as const)(
    'ativa o relógio de uma carreira solo existente via %s, preservando o time e os resultados',
    async (trigger) => {
      const repository = new LocalLeagueRepository(undefined);
      const legacy = unwrap(
        playNextBatch(
          unwrap(
            createWorld({
              id: IDS.league,
              userId: host.userId,
              name: 'Carreira existente',
              mode: 'offline',
              now,
            }),
          ),
          now - 100000,
        ),
      );
      legacy.nextScheduledAt = now + 365 * 86400000;
      await repository.create(legacy);
      const service = new LeagueService(repository, () => now);
      if (trigger === 'snapshot') await service.snapshot(legacy.id, host.userId);
      else await service.tick();
      const saved = (await repository.load(legacy.id))!.state;
      expect(saved.seasonClock).toBe(1);
      expect(saved.nextScheduledAt).toBe(nextRealMatchTime(now));
      expect(saved.results).toEqual(legacy.results);
      expect(saved.fixtures).toEqual(legacy.fixtures);
      expect(saved.players).toEqual(legacy.players);
      expect(saved.participants.map((member) => member.clubId)).toEqual(
        legacy.participants.map((member) => member.clubId),
      );
      const fixture = pendingFixtures(saved)[0]!;
      expect(realFixtureTime(saved, pendingFixtures(saved), fixture)).toBe(saved.nextScheduledAt);
    },
  );
});
