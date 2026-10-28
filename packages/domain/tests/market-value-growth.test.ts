import { describe, expect, it } from 'vitest';
import { revalueGrowth } from '../src/players/development.js';
import { createWorld, stableId } from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const state = unwrap(
  createWorld({
    id: stableId(200, 1),
    name: 'Valor',
    mode: 'offline',
    userId: 'host',
    now: Date.parse('2026-01-15T15:00:00Z'),
  }),
);
const player = Object.values(state.players.byId)[0]!;
describe('valorização por evolução permanente', () => {
  it('aumenta o valor a cada ponto e considera ganhos de múltiplos pontos', () => {
    const one = revalueGrowth(player, { ...player, overall: player.overall + 1 });
    const two = revalueGrowth(player, { ...player, overall: player.overall + 2 });
    expect(one.marketValue.cents).toBeGreaterThan(player.marketValue.cents);
    expect(two.marketValue.cents).toBeGreaterThan(one.marketValue.cents);
  });
  it('não valoriza novamente sem evolução', () => {
    expect(revalueGrowth(player, { ...player, fitness: 90 }).marketValue).toEqual(
      player.marketValue,
    );
  });
});
