import { describe, expect, it } from 'vitest';
import { MARACANA_TIERS } from '../src/three/maracana-layout';
import { MORUMBI_TIERS } from '../src/three/morumbi-layout';

describe('perfil baixo do Maracanã e do Morumbi', () => {
  it('mantém os degraus do Maracanã abaixo de 32 graus e o anel superior abaixo de 24 unidades', () => {
    for (const t of MARACANA_TIERS)
      expect((Math.atan(t.rise / Math.min(t.stepX, t.stepZ)) * 180) / Math.PI).toBeLessThan(32);
    expect(Math.max(...MARACANA_TIERS.map((t) => t.y + (t.rows - 1) * t.rise))).toBeLessThan(24);
  });
  it('mantém os degraus do Morumbi abaixo de 35 graus e o anel superior abaixo de 27 unidades', () => {
    for (const t of MORUMBI_TIERS)
      expect((Math.atan(t.rise / t.step) * 180) / Math.PI).toBeLessThan(35);
    expect(Math.max(...MORUMBI_TIERS.map((t) => t.y + (t.rows - 1) * t.rise))).toBeLessThan(27);
  });
});
