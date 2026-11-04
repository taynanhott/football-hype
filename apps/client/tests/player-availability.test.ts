import { describe, expect, it, vi } from 'vitest';
import type { ClubSnapshot, WorldState } from '@football/shared';
import { clubAvailabilityReturns } from '../src/features/players/player-availability';

vi.mock('../src/features/competitions/club-calendar-fixtures', () => ({
  clubCalendarFixtures: (state: WorldState) => state.fixtures,
}));
const at = (day: string) => Date.parse(`${day}T18:00:00-03:00`);
const club = {
  id: 'club',
  trainingCenterId: 'ct',
  playerIds: ['player'],
} as unknown as ClubSnapshot;
function world(overrides: Partial<WorldState> = {}) {
  return {
    lastProcessedAt: at('2026-03-23'),
    nextScheduledAt: at('2026-03-25'),
    players: { byId: { player: { id: 'player', clubId: 'club', overall: 83 } } },
    clubs: { byId: { club } },
    centers: { byId: { ct: { operations: { medical: [] } } } },
    injuries: {},
    results: [],
    fixtures: ['2026-03-25', '2026-03-31', '2026-04-01'].map((day, i) => ({
      id: String(i),
      scheduledAt: at(day),
    })),
    ...overrides,
  } as unknown as WorldState;
}
describe('retorno dos jogadores indisponíveis', () => {
  it('conta partidas até o último dia da convocação e libera no dia seguinte', () => {
    const result = clubAvailabilityReturns(world(), club).get('player')!;
    expect(result.games).toBe(2);
    expect(result.at).toBe(Date.parse('2026-04-01T00:00:00-03:00'));
  });
  it('exclui partidas já disputadas da contagem restante', () => {
    const state = world();
    const result = clubAvailabilityReturns(
      { ...state, results: [{ fixtureId: '0' }] as WorldState['results'] },
      club,
    ).get('player')!;
    expect(result.games).toBe(1);
  });
  it('usa a recuperação da lesão quando ela terminar depois da convocação', () => {
    const result = clubAvailabilityReturns(world({ injuries: { player: 12 } }), club).get(
      'player',
    )!;
    expect(result.injured).toBe(true);
    expect(result.calledUp).toBe(true);
    expect(result.games).toBe(12);
    expect(result.at).toBeNull();
  });
});

it('tratamento médico avança a recuperação a cada partida, sem depender de dias', () => {
  const state = world({
    injuries: { player: 4 },
    players: {
      byId: { player: { id: 'player', clubId: 'club', overall: 70 } },
    } as unknown as WorldState['players'],
  });
  const center = state.centers.byId.ct!;
  const treated = {
    ...state,
    centers: {
      ...state.centers,
      byId: { ct: { ...center, operations: { ...center.operations!, medical: ['player'] } } },
    },
  };
  const result = clubAvailabilityReturns(treated, club).get('player')!;
  expect(result.games).toBe(2);
  expect(result.at).toBe(at('2026-03-31') + 1);
});
