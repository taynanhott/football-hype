import { describe, expect, it } from 'vitest';
import { type Fixture, type WorldState } from '@football/shared';
import { createWorld } from '../src/index.js';
import { progressSerieC } from '../src/competitions/serie-c.js';
import { addUnstartedCupGroups } from '../src/competitions/cup-groups.js';
import { clubCalendarRoutine, clubDayRoutine } from '../src/game/daily-calendar.js';
import { potentialStars, interestLabel } from '../src/game/management.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-01-15T15:00:00Z');
const base = () =>
  unwrap(createWorld({ id: IDS.league, name: 'Legado', userId: IDS.user, mode: 'offline', now }));
const results = (fixtures: Fixture[]) =>
  fixtures.map((f) => ({
    fixtureId: f.id,
    homeId: f.homeId,
    awayId: f.awayId,
    homeGoals: 1,
    awayGoals: 0,
    attendance: 0,
    revenue: 0,
    seed: 1,
    scorers: [],
    status: 'finished',
  }));

describe('compatibilidade de temporadas já persistidas', () => {
  it('preserva grupos existentes sem gerar um novo sorteio na recuperação', () => {
    const state = base();
    expect(addUnstartedCupGroups(state)).toBe(state);
    const clubId = state.clubs.ids[0]!;
    expect(clubCalendarRoutine(state, clubId, now)).toBe(
      clubDayRoutine(state.fixtures, clubId, now),
    );
  });
  it('conclui o formato antigo da Série C sem repetir grupos ou final', () => {
    const original = base();
    const ids = original.clubs.ids.slice(0, 8);
    const fixtures: Fixture[] = Array.from({ length: 4 }, (_, i) => ({
      id: `legacy-${i}`,
      competitionId: 'serie-c',
      homeId: ids[i * 2]!,
      awayId: ids[i * 2 + 1]!,
      round: 0,
      scheduledAt: now,
    }));
    const state: WorldState = { ...original, cups: [], fixtures, results: [] };
    expect(progressSerieC(state)).toBe(state);
    expect(progressSerieC({ ...state, fixtures: [] }).fixtures).toHaveLength(0);
    const small = {
      ...state,
      fixtures: fixtures.slice(0, 1),
      results: results(fixtures.slice(0, 1)),
    };
    expect(progressSerieC(small)).toBe(small);
    const grouped = progressSerieC({ ...state, results: results(fixtures) });
    expect(grouped.fixtures).toHaveLength(28);
    expect(new Set(grouped.fixtures.slice(4).flatMap((f) => [f.homeId, f.awayId])).size).toBe(8);
    expect(progressSerieC(grouped)).toBe(grouped);
    const finished = { ...grouped, results: results(grouped.fixtures) };
    const final = progressSerieC(finished);
    expect(final.cups).toHaveLength(1);
    expect(final.cups[0]).toMatchObject({ competitionId: 'serie-c', legs: 2, label: 'Final' });
    expect(final.cups[0]!.homeId).not.toBe(final.cups[0]!.awayId);
    expect(progressSerieC(final)).toBe(final);
    const malformed = {
      ...finished,
      fixtures: finished.fixtures.map((f) => (f.group ? { ...f, group: 'B' } : f)),
    };
    expect(progressSerieC(malformed)).toBe(malformed);
  });
  it('mantém as faixas de potencial e as descrições de interesse nos limites', () => {
    expect([1, 50, 59, 60, 69, 70, 79, 80, 89, 90, 99, 110].map(potentialStars)).toEqual([
      1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5,
    ]);
    expect([0, 1, 25, 26, 50, 51, 75, 76, 100].map(interestLabel)).toEqual([
      'Nenhum',
      'Baixo',
      'Baixo',
      'Médio',
      'Médio',
      'Alto',
      'Alto',
      'Muito interesse',
      'Muito interesse',
    ]);
  });
});
