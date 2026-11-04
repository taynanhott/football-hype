import { describe, expect, it } from 'vitest';
import { playStyleSchema, formationSchema } from '@football/shared';
import { STYLE_ADVANTAGES, tacticalBonus } from '../src/game/management.js';
describe('equilíbrio dos estilos táticos', () => {
  it('cada estilo tem duas vantagens e duas fraquezas sem confrontos contraditórios', () => {
    for (const style of playStyleSchema.options) {
      expect(STYLE_ADVANTAGES[style]).toHaveLength(2);
      expect(STYLE_ADVANTAGES[style]).not.toContain(style);
      expect(
        playStyleSchema.options.filter((other) => STYLE_ADVANTAGES[other].includes(style)),
      ).toHaveLength(2);
      for (const defeated of STYLE_ADVANTAGES[style])
        expect(STYLE_ADVANTAGES[defeated]).not.toContain(style);
    }
  });
  it('calcula todas as combinações de estilo e formação, incluindo pressão total', () => {
    expect(playStyleSchema.parse('all-out-press')).toBe('all-out-press');
    for (const style of playStyleSchema.options)
      for (const opponent of playStyleSchema.options)
        for (const formation of formationSchema.options) {
          expect(Number.isFinite(tacticalBonus(style, formation, opponent, '4-4-2', []))).toBe(
            true,
          );
        }
  });
});
