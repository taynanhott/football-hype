import { describe, expect, it } from 'vitest';
import { vilaOutline, VILA_ROWS } from '../src/three/vila-belmiro-layout';

describe('união dos setores da Vila Belmiro', () => {
  it('une as quatro curvas aos setores retos sem saltos de altura', () => {
    for (let row = 0; row < VILA_ROWS; row++) {
      const outline = vilaOutline(row / (VILA_ROWS - 1));
      for (const i of [16, 33, 50, 67]) {
        const a = outline[i]!,
          b = outline[(i + 1) % outline.length]!;
        expect(a[1]).toBeCloseTo(b[1], 10);
        expect(Math.min(Math.abs(a[0] - b[0]), Math.abs(a[2] - b[2]))).toBeLessThan(1e-10);
      }
    }
  });
  it('concentra a diferença de altura no encontro da tribuna alta com a curva', () => {
    const top = vilaOutline(1);
    expect(top[34]![1]).toBeGreaterThan(20);
    // Two samples into either corner, the terrace already follows the lower goal sector.
    expect(top[36]![1]).toBeCloseTo(13.7);
    expect(top[31]![1]).toBeCloseTo(10.2);
  });
  it('mantém o fechamento dentro da fachada e acima das faixas externas', () => {
    const rear = vilaOutline(1, true),
      bowl = vilaOutline((VILA_ROWS - 0.5) / (VILA_ROWS - 1));
    rear.forEach((p, i) => {
      expect(Math.abs(p[0])).toBeGreaterThanOrEqual(Math.abs(bowl[i]![0]) - 1e-9);
      expect(Math.abs(p[2])).toBeGreaterThanOrEqual(Math.abs(bowl[i]![2]) - 1e-9);
      expect(p[1]).toBeGreaterThanOrEqual(12.2);
    });
  });
});
