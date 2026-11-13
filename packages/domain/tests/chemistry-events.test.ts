import { describe, expect, it } from 'vitest';
import { createWorld, advanceGameDays, playNextBatch, temporaryModifiers } from '../src/index.js';
import { changeChemistry } from '../src/game/chemistry.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
import type { MatchResult } from '@football/shared';

const now = Date.parse('2026-01-15T15:00:00Z');
function setup() {
  const state = advanceGameDays(
    unwrap(
      createWorld({ id: IDS.league, userId: IDS.user, name: 'Entrosamento', mode: 'offline', now }),
    ),
    now,
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const away = state.clubs.ids.find((id) => id !== club.id)!;
  const id = club.playerIds.at(-1)!;
  const starters = club.playerIds.filter((p) => p !== id).slice(0, 11);
  state.tactics[club.id] = {
    formation: '4-3-3',
    starters,
    instructions: { protected: starters, substitutions: [], situations: [] },
  };
  state.cups = [];
  state.fixtures = [
    {
      id: 'chemistry-current',
      competitionId: 'serie-a',
      round: 1,
      homeId: club.id,
      awayId: away,
      scheduledAt: now,
    },
  ];
  state.chemistry = { [club.id]: { [id]: 5 } };
  return { state, club, id, away };
}
describe('entrosamento por evento', () => {
  it('retorno da lesão perde cinco pontos uma vez, mesmo com saldo legado acima do teto', () => {
    const { state, club, id } = setup();
    state.injuries = { [id]: 1 };
    state.chemistry[club.id]![id] = 100;
    const next = unwrap(playNextBatch(state, now));
    expect(next.injuries[id]).toBe(0);
    expect(next.chemistry[club.id]?.[id]).toBeCloseTo(4.75);
    expect(advanceGameDays(next, next.lastProcessedAt).chemistry[club.id]?.[id]).toBeCloseTo(4.75);
    expect(state.chemistry[club.id]?.[id]).toBe(100);
  });
  it('a sexta partida fora ativa Sem sequência e perde um ponto por partida adicional', () => {
    const { state, club, id, away } = setup();
    state.results = Array.from({ length: 5 }, (_, i): MatchResult => ({
      status: 'finished',
      fixtureId: `past-${i}`,
      homeId: club.id,
      awayId: away,
      homeGoals: 0,
      awayGoals: 0,
      revenue: 0,
      attendance: 0,
      seed: i,
      scorers: [],
    }));
    expect(
      temporaryModifiers(state, state.players.byId[id]!).some(
        (effect) => effect.label === 'Sem sequência',
      ),
    ).toBe(false);
    const next = unwrap(playNextBatch(state, now));
    expect(
      temporaryModifiers(next, next.players.byId[id]!).some(
        (effect) => effect.label === 'Sem sequência',
      ),
    ).toBe(true);
    expect(next.chemistry[club.id]?.[id]).toBeCloseTo(4.95);
    const subsequent = setup().state;
    subsequent.results = [
      ...state.results,
      next.results.find((game) => game.fixtureId === 'chemistry-current')!,
    ];
    subsequent.fixtures = [{ ...state.fixtures[0]!, id: 'chemistry-next', round: 2 }];
    subsequent.chemistry = { [club.id]: { [id]: next.chemistry[club.id]![id]! } };
    const again = unwrap(playNextBatch(subsequent, now));
    expect(again.chemistry[club.id]?.[id]).toBeCloseTo(4.9);
  });
  it('mantém perdas no intervalo de zero a cem por cento', () => {
    expect(changeChemistry(999, -5)).toBeCloseTo(4.75);
    expect(changeChemistry(0, -1)).toBe(0);
    expect(changeChemistry(5, 20)).toBe(5);
  });
});
