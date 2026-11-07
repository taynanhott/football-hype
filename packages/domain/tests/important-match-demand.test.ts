import { describe, expect, it } from 'vitest';
import { createWorld, matchDemand, scheduledFixtures, stableId } from '../src/index.js';
import { projectTicketDemand, TICKET_TIERS } from '../src/finance/match-demand.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const state = unwrap(
  createWorld({
    id: stableId(812, 1),
    userId: 'host',
    name: 'Torcida',
    mode: 'offline',
    now: Date.UTC(2026, 0, 15),
  }),
);
const fixture = scheduledFixtures(state)[0]!;
describe('torcida em partidas importantes', () => {
  it('aumenta adesão em todas as faixas de preço, respeitando a capacidade', () => {
    const base = {
      capacity: 10000,
      commerce: 0,
      selloutPriceCents: 50,
      minimumCrowdPriceCents: 400,
      demandFactor: 0.9,
    };
    for (const tier of TICKET_TIERS) {
      const regular = projectTicketDemand(base, tier.priceCents);
      const important = projectTicketDemand({ ...base, crowdBoost: 0.25 }, tier.priceCents);
      expect(important.attendance).toBeGreaterThan(regular.attendance);
      expect(important.attendance).toBeLessThanOrEqual(base.capacity);
    }
  });
  it('identifica clássico e combina sua procura com a final', () => {
    const home = state.clubs.byId[fixture.homeId]!;
    const away = state.clubs.byId[fixture.awayId]!;
    const derbyState = {
      ...state,
      cups: [],
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [home.id]: { ...home, abbreviation: 'FLA', country: 'Brasil' },
          [away.id]: { ...away, abbreviation: 'FLU', country: 'Brasil' },
        },
      },
    };
    const regular = { ...fixture, id: 'regular', competitionId: 'serie-a', round: 1 };
    expect(matchDemand(derbyState, regular).crowdBoost).toBe(0.2);
    const final = { ...regular, id: 'final', competitionId: 'copa-brasil' };
    const finalState = {
      ...derbyState,
      cups: [{ ...final, leftId: null, rightId: null, winnerId: null }],
    };
    const demand = matchDemand(finalState, final);
    expect(demand.crowdBoost).toBe(0.5);
    expect(demand.importanceLabel).toContain('Clássico');
    expect(projectTicketDemand(demand, 400).attendance).toBe(
      matchDemand(finalState, final, 400).attendance,
    );
  });
});
