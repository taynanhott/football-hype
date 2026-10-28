import { describe, it, expect } from 'vitest';
import { competitionClubKey, isSerieC2026, SERIE_C_2026 } from '@football/shared';
import {
  createWorld,
  groupFixtures,
  cupGroupTables,
  qualifyCupGroups,
  copaBrasilBracket,
  resetSeasonCompetitions,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-10-27T15:00:00Z');
const base = () =>
  unwrap(createWorld({ id: IDS.league, userId: IDS.user, name: 'Regras', mode: 'offline', now }));
const score = (f: { id: string; homeId: string; awayId: string }) => ({
  fixtureId: f.id,
  homeId: f.homeId,
  awayId: f.awayId,
  homeGoals: 1,
  awayGoals: 0,
  seed: 1,
  revenue: 0,
  attendance: 0,
  scorers: [],
  status: 'finished',
});

describe('regulamentos oficiais 2026', () => {
  it('reconhece os 20 participantes da Série C com acentos e abreviações', () => {
    expect(SERIE_C_2026).toHaveLength(20);
    expect(new Set(SERIE_C_2026.map(competitionClubKey)).size).toBe(20);
    expect(isSerieC2026('Botafogo-PB')).toBe(true);
    expect(isSerieC2026('Botafogo')).toBe(false);
    expect(isSerieC2026('Anapolis')).toBe(true);
  });
  it.each(['copa-nordeste', 'copa-sul-sudeste', 'copa-verde', 'libertadores'])(
    '%s tem seis jogos por clube e 16 classificados',
    (competition) => {
      const ids = Array.from({ length: 32 }, (_, i) => `club-${i}`);
      const dates = Array.from({ length: 6 }, (_, i) => now + i * 86400000);
      const fixtures = groupFixtures(ids, competition, dates, 2);
      expect(fixtures).toHaveLength(96);
      for (const id of ids)
        expect(fixtures.filter((f) => f.homeId === id || f.awayId === id)).toHaveLength(6);
      const groups = cupGroupTables({ fixtures, results: fixtures.map(score) }, competition);
      expect(groups).toHaveLength(8);
      expect(groups.every((group) => group.table.every((row) => row.played === 6))).toBe(true);
      const state = qualifyCupGroups({
        ...base(),
        fixtures,
        results: fixtures.map(score),
        cups: [],
      });
      expect(
        state.cups.filter((node) => node.competitionId === competition && node.round === 0),
      ).toHaveLength(8);
    },
  );
  it('Séries A, B e C têm 38 rodadas sem quadrangulares', () => {
    const state = base();
    for (const id of ['serie-a', 'serie-b', 'serie-c']) {
      const fixtures = state.fixtures.filter((f) => f.competitionId === id);
      expect(fixtures).toHaveLength(380);
      expect(new Set(fixtures.map((f) => f.round)).size).toBe(38);
    }
  });
  it('Copa do Brasil tem nove fases e entradas nas fases 2, 3 e 5, sem grupos', () => {
    const ids = Array.from({ length: 126 }, (_, i) => `team-${i}`);
    const nodes = copaBrasilBracket(
      ids.slice(0, 20),
      ids.slice(20, 24),
      ids.slice(24),
      Array.from({ length: 9 }, (_, i) => now + i * 86400000),
    );
    expect(
      Array.from({ length: 9 }, (_, round) => nodes.filter((n) => n.round === round).length),
    ).toEqual([14, 44, 24, 12, 16, 8, 4, 2, 1]);
    expect(nodes.filter((n) => n.legs === 2).every((n) => n.round >= 4 && n.round <= 7)).toBe(true);
    expect(nodes.at(-1)?.legs).toBe(1);
  });
  it('Sul-Americana espera os terceiros da Libertadores e cria playoffs com vaga direta dos líderes', () => {
    const world = base();
    const ids = world.clubs.ids.slice(0, 64);
    const dates = Array.from({ length: 6 }, (_, i) => now + i * 86400000);
    const lib = groupFixtures(ids.slice(0, 32), 'libertadores', dates, 2);
    const sud = groupFixtures(ids.slice(32), 'sul-americana', dates, 2);
    const state = {
      ...world,
      fixtures: [...lib, ...sud],
      cups: [],
      results: [...lib, ...sud].map(score),
    };
    const qualified = qualifyCupGroups(state);
    const nodes = qualified.cups.filter((n) => n.competitionId === 'sul-americana');
    expect(nodes.filter((n) => n.label === 'Playoff das oitavas')).toHaveLength(8);
    expect(nodes.filter((n) => n.round === 1)).toHaveLength(8);
    expect(
      nodes.filter((n) => n.round === 1).every((n) => n.homeId && n.awayId === null && n.rightId),
    ).toBe(true);
    expect(nodes.filter((n) => n.round === 4)[0]?.legs).toBe(1);
  });
  it('reinicia resultados e calendário preservando clube e elenco', () => {
    const state = base();
    const next = resetSeasonCompetitions({ ...state, round: 9 }, now);
    expect(next.round).toBe(0);
    expect(next.results).toEqual([]);
    expect(next.players.ids).toEqual(state.players.ids);
    expect(next.competitionRulesVersion).toBe(202604);
    expect(next.fixtures.filter((f) => f.competitionId === 'serie-c')).toHaveLength(380);
    expect(next.fixtures.filter((f) => f.competitionId === 'serie-d').length).toBeGreaterThan(0);
    expect(next.fixtures.some((f) => f.competitionId.startsWith('estadual'))).toBe(false);
  });
});
