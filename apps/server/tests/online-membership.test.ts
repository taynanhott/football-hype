import { describe, expect, it } from 'vitest';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';
const start = Date.parse('2026-10-26T15:00:00Z');
const host = { userId: 'host', name: 'Host', guest: true };
const guest = { userId: 'guest', name: 'Guest', guest: true };
async function setup() {
  let now = start;
  const repo = new LocalLeagueRepository(undefined);
  const service = new LeagueService(repo, () => now);
  const id = await service.create(host, { mode: 'multiplayer' });
  const state = (await service.snapshot(id, host.userId)).state;
  return {
    service,
    repo,
    id,
    state,
    clock: (value: number) => {
      now = value;
    },
  };
}
describe('convites e vagas online', () => {
  it('entra imediatamente com código válido, permite reconectar e respeita divisão e sorteio', async () => {
    const { service, id, state } = await setup();
    await expect(service.join(id, guest)).rejects.toThrow('Acesso negado');
    await expect(service.requestEntry(id, guest, { code: 'errado' })).rejects.toThrow(
      'Convite inválido',
    );
    await service.command(id, host.userId, {
      type: 'admission',
      division: 'B',
      assignment: 'random',
    });
    await service.requestEntry(id, guest, { code: state.inviteCode });
    expect((await service.snapshot(id, guest.userId)).state.requests).toHaveLength(0);

    await service.join(id, guest);
    const approved = (await service.snapshot(id, guest.userId)).state;
    const member = approved.participants.find((p) => p.userId === guest.userId);
    expect(approved.clubs.byId[member?.clubId ?? '']?.division).toBe('B');
    await expect(
      service.command(id, guest.userId, { type: 'admission', division: 'A', assignment: 'chosen' }),
    ).rejects.toThrow('administrador');
  });
  it('preserva o clube e a administração após 48 horas desconectado', async () => {
    const { service, repo, id, state, clock } = await setup();
    await service.command(id, host.userId, {
      type: 'admission',
      division: null,
      assignment: 'random',
    });
    await service.requestEntry(id, guest, { code: state.inviteCode });

    clock(start + 172800000 - 1);
    await service.touch(id, guest.userId);
    expect((await service.snapshot(id, host.userId)).state.participants).toHaveLength(2);
    clock(start + 172800000);
    await service.snapshot(id, host.userId);
    const saved = await repo.load(id);
    expect(saved?.state.participants.map((p) => p.userId)).toEqual([host.userId, guest.userId]);
    expect(saved?.state.administratorId).toBe(host.userId);
    await expect(service.join(id, host)).resolves.toBeUndefined();
  });
  it('abandona, libera vínculo e bloqueia acesso após exclusão', async () => {
    const { service, id, state } = await setup();
    await service.command(id, host.userId, {
      type: 'admission',
      division: null,
      assignment: 'random',
    });
    await service.requestEntry(id, guest, { code: state.inviteCode });

    await service.leave(id, guest.userId);
    expect(await service.list(guest.userId)).toHaveLength(0);
    await expect(service.snapshot(id, guest.userId)).rejects.toThrow('Acesso negado');
    await service.leave(id, host.userId, true);
    expect(await service.list(host.userId)).toHaveLength(0);
    await expect(service.snapshot(id, host.userId)).rejects.toThrow('Acesso negado');
    expect(await service.create(host, { mode: 'multiplayer' })).not.toBe(id);
  });
  it('impede avançar outra rodada durante a apresentação de 90 segundos', async () => {
    const { service, id } = await setup();
    await service.command(id, host.userId, { type: 'advance' });
    await expect(service.command(id, host.userId, { type: 'advance' })).rejects.toThrow(
      '90 segundos',
    );
  });
  it('permite avançar quando as partidas em andamento envolvem apenas clubes da IA', async () => {
    const { service, repo, id } = await setup();
    await service.command(id, host.userId, { type: 'advance' });
    const saved = (await repo.load(id))!;
    const humanClubs = new Set(saved.state.participants.map((participant) => participant.clubId));
    saved.state.results = saved.state.results.filter(
      (result) => !humanClubs.has(result.homeId ?? '') && !humanClubs.has(result.awayId ?? ''),
    );
    expect(saved.state.results.length).toBeGreaterThan(0);
    await expect(service.command(id, host.userId, { type: 'advance' })).resolves.toBeTypeOf(
      'number',
    );
  });
});
