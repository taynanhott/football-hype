import { describe, expect, it } from 'vitest';
import { positionSchema } from '@football/shared';
import { canLearnPosition, positionFactor } from '../src/game/tactics.js';

describe('penalidade por proximidade das posições', () => {
  it.each([
    ['LW', 'LM'],
    ['RW', 'RM'],
    ['CM', 'DM'],
    ['CM', 'AM'],
    ['LB', 'LWB'],
    ['RB', 'RWB'],
    ['LWB', 'LM'],
    ['RWB', 'RM'],
    ['ST', 'SS'],
    ['SS', 'AM'],
    ['CB', 'DM'],
  ] as const)('suaviza funções vizinhas: %s → %s', (natural, assigned) => {
    expect(positionFactor(natural, assigned)).toBe(0.97);
  });

  it('considera a faixa do campo e mantém mudanças distantes', () => {
    expect(positionFactor('LW', 'ST')).toBe(0.94);
    expect(positionFactor('LW', 'LM')).toBeGreaterThan(positionFactor('LW', 'RM'));
    expect(positionFactor('LW', 'CB')).toBe(0.45);
    expect(positionFactor('LW', 'LB')).toBe(0.85);
    expect(positionFactor('GK', 'ST')).toBe(0.35);
  });

  it('reduz a perda também nas posições próximas fora da lista de aprendizado', () => {
    for (const [natural, assigned] of [
      ['CM', 'ST'],
      ['AM', 'ST'],
      ['CB', 'CM'],
      ['LB', 'CB'],
      ['RB', 'CB'],
    ] as const) {
      expect(positionFactor(natural, assigned)).toBeGreaterThanOrEqual(0.94);
      expect(positionFactor(assigned, natural)).toBe(positionFactor(natural, assigned));
    }
  });

  it('mantém limites e adaptação para todas as combinações', () => {
    for (const natural of positionSchema.options) {
      for (const assigned of positionSchema.options) {
        const base = positionFactor(natural, assigned);
        expect(base).toBeGreaterThanOrEqual(0.35);
        expect(base).toBeLessThanOrEqual(1);
        expect(positionFactor(natural, assigned, 7)).toBeGreaterThanOrEqual(base);
        if (canLearnPosition(natural, assigned))
          expect(positionFactor(natural, assigned, 15)).toBe(1);
      }
    }
  });
});
