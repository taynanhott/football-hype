import { describe, expect, it } from 'vitest';
import { createWorld, stableId } from '../src/index.js';
import { careerAmbition } from '../src/game/career-ambition.js';
import { developmentFactor } from '../src/game/training-progression.js';
import { renewalTerms } from '../src/game/player-contracts.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const original = unwrap(
  createWorld({
    id: stableId(998, 1),
    userId: 'host',
    name: 'Carreira',
    mode: 'offline',
    now: Date.UTC(2026, 0, 15),
  }),
);
const club = Object.values(original.clubs.byId)[0]!;
const player = {
  ...original.players.byId[club.playerIds[0]!]!,
  age: 20,
  overall: 90,
  potential: 95,
};
const state = {
  ...original,
  lastProcessedAt: original.createdAt + 200 * 86400000,
  clubs: {
    ...original.clubs,
    byId: {
      ...original.clubs.byId,
      [club.id]: { ...club, division: 'C' as const, leagueStrength: 50 },
    },
  },
};
describe('desenvolvimento e ambição', () => {
  it('potencial alto sozinho não gera ambição de saída', () =>
    expect(careerAmbition(state, { ...player, overall: 55 })).toBe(0));
  it('protege a adaptação e identifica talento acima da divisão', () => {
    expect(careerAmbition(original, player)).toBe(0);
    expect(careerAmbition(state, player)).toBe(100);
    expect(renewalTerms(state, player).reason).toContain('liga mais forte');
  });
  it('reduz a pressão quando a divisão acompanha a evolução', () => {
    const promoted = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: { ...state.clubs.byId, [club.id]: { ...club, leagueStrength: 80 } },
      },
    };
    expect(careerAmbition(promoted, player)).toBe(0);
  });
  it('jovens evoluem mais e os últimos pontos exigem mais tempo', () => {
    expect(developmentFactor(player)).toBeGreaterThan(developmentFactor({ ...player, age: 30 }));
    expect(developmentFactor({ ...player, overall: 94 })).toBeLessThan(developmentFactor(player));
    expect(developmentFactor({ ...player, overall: 95 })).toBe(0);
  });
});
