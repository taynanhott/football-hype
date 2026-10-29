import { describe, it, expect } from 'vitest';
import {
  createWorld,
  continentalPlaces,
  regionalPromotions,
  standings,
  seasonSchedule,
  penaltyShootout,
  scheduleIntercontinental,
  playNextBatch,
  resolveLineup,
  executeCommand,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-10-27T15:00:00Z');
const world = () =>
  unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Regras solicitadas',
      mode: 'offline',
      now,
    }),
  );
describe('regras personalizadas da imagem', () => {
  it('gera 38 rodadas nas três séries e Copa do Brasil de 32 com final em ida e volta', () => {
    const state = world();
    for (const id of ['serie-a', 'serie-b', 'serie-c'])
      expect(state.fixtures.filter((f) => f.competitionId === id)).toHaveLength(380);
    const cup = state.cups.filter((n) => n.competitionId === 'copa-brasil');
    expect(cup).toHaveLength(31);
    expect(cup.filter((n) => n.round === 0)).toHaveLength(16);
    expect(cup.filter((n) => n.round < 4).every((n) => n.legs === 1)).toBe(true);
    expect(cup.find((n) => n.round === 4)?.legs).toBe(2);
    const ids = new Set(cup.flatMap((n) => [n.homeId, n.awayId].filter(Boolean)));
    expect([...ids].filter((id) => state.clubs.byId[id!]?.division === 'A')).toHaveLength(20);
    expect([...ids].filter((id) => state.clubs.byId[id!]?.division === 'B')).toHaveLength(12);
  });
  it('concede uma única vaga por clube, herda títulos repetidos e limita repasses ao 16º', () => {
    const state = world();
    const table = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'A');
    const champ = table.slice().sort()[0]!;
    state.cups = [
      {
        id: 'copa-brasil:final',
        competitionId: 'copa-brasil',
        round: 4,
        homeId: champ,
        awayId: table[19]!,
        leftId: null,
        rightId: null,
        winnerId: champ,
        scheduledAt: now,
      },
    ];
    const slots = continentalPlaces(state);
    expect(new Set(slots.map((p) => p.clubId)).size).toBe(slots.length);
    expect(slots.filter((p) => p.clubId === champ)).toHaveLength(1);
    expect(slots.some((p) => p.origin === 'inherited')).toBe(true);
    expect(slots.filter((p) => p.origin !== 'title').length).toBeLessThanOrEqual(16);
  });
  it('mantém quatro acessos pela tabela da Série D sem prioridade das regionais', () => {
    const state = world();
    const d = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'D');
    state.cups = ['copa-nordeste', 'copa-sul-sudeste', 'copa-verde'].map(
      (competitionId, index) => ({
        id: `${competitionId}:final`,
        competitionId,
        round: 3,
        homeId: d[index]!,
        awayId: d[index + 3]!,
        leftId: null,
        rightId: null,
        winnerId: d[index]!,
        scheduledAt: now,
      }),
    );
    const promoted = regionalPromotions(state);
    expect(promoted).toHaveLength(4);
    expect(new Set(promoted).size).toBe(4);
    expect(promoted).toEqual(
      standings(
        d,
        state.fixtures.filter((f) => f.competitionId === 'serie-d'),
        state.results,
      )
        .slice(0, 4)
        .map((row) => row.id),
    );
  });
  it('resolve empates por pênaltis com placar persistido', () => {
    const state = world();
    const home = state.clubs.byId[state.clubs.ids[0]!]!,
      away = state.clubs.byId[state.clubs.ids[1]!]!;
    expect(penaltyShootout(() => 0.5).home).not.toBe(penaltyShootout(() => 0.5).away);
    expect(home.id).not.toBe(away.id);
  });
  it('só encerra depois da Intercontinental em estádio neutro com a tática atual', () => {
    let state = world();
    const home = state.clubs.byId[state.clubs.ids[0]!]!,
      away = state.clubs.byId[state.clubs.ids[1]!]!;
    state = {
      ...state,
      fixtures: [],
      results: [],
      cups: [
        {
          id: 'lib:final',
          competitionId: 'libertadores',
          round: 3,
          homeId: home.id,
          awayId: away.id,
          leftId: null,
          rightId: null,
          winnerId: home.id,
          scheduledAt: now,
        },
        {
          id: 'eur:final',
          competitionId: 'europa',
          round: 3,
          homeId: away.id,
          awayId: home.id,
          leftId: null,
          rightId: null,
          winnerId: away.id,
          scheduledAt: now,
        },
      ],
    };
    state = scheduleIntercontinental(state);
    const final = state.cups.find((n) => n.competitionId === 'intercontinental')!;
    expect(final.neutral).toBe(true);
    expect(final.stadiumId).not.toBe(home.stadiumId);
    expect(final.stadiumId).not.toBe(away.stadiumId);
    const expected = resolveLineup(state, home, final.scheduledAt, state.players.byId).flatMap(
      (entry) => (entry.player ? [entry.player.id] : []),
    );
    const after = unwrap(playNextBatch(state, now));
    expect(after.status).toBe('finished');
    expect(after.results.at(-1)?.lineups?.home).toEqual(expected);
    expect(after.results.at(-1)?.stadiumId).toBe(final.stadiumId);
    expect(executeCommand(after, { type: 'new-season' }, IDS.user, now, IDS.secondUser).ok).toBe(
      false,
    );
    expect(
      executeCommand(after, { type: 'new-season' }, IDS.user, now + 90001, IDS.secondUser).ok,
    ).toBe(true);
  });
  it('não duplica participantes da Copa do Brasil após acessos entre A e B', () => {
    const state = world();
    const a = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'A');
    const b = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'B');
    const clubs = Object.values(state.clubs.byId).map((club) =>
      b.slice(0, 4).includes(club.id)
        ? { ...club, division: 'A' as const }
        : a.slice(-4).includes(club.id)
          ? { ...club, division: 'B' as const }
          : club,
    );
    const schedule = seasonSchedule(clubs, now, { libertadores: [], sulAmericana: [], serieB: b });
    expect(schedule.cups.filter((n) => n.competitionId === 'copa-brasil')).toHaveLength(31);
  });
});
