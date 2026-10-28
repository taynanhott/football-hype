import { describe, it, expect } from 'vitest';
import { createCityLayout, cityReserved } from '../src/three/city-layout';
describe('stadium neighborhood', () => {
  it('has a repeatable mixed neighborhood on all sides', () => {
    const c = createCityLayout(17);
    expect(createCityLayout(17)).toEqual(c);
    for (const kind of ['house', 'apartment', 'office'])
      expect(c.buildings.filter((b) => b.kind === kind).length).toBeGreaterThan(25);
    expect(c.trees.length).toBeGreaterThan(200);
    for (const filter of [
      (b: { x: number; z: number }) => b.x < -160,
      (b: { x: number; z: number }) => b.x > 300,
      (b: { x: number; z: number }) => b.z < -135,
      (b: { x: number; z: number }) => b.z > 155,
    ])
      expect(c.buildings.filter(filter).length).toBeGreaterThan(30);
  });
  it('keeps buildings off the stadium, training center and roads', () => {
    for (const seed of [1, 17, 65535]) {
      const c = createCityLayout(seed);
      for (const b of c.buildings) {
        for (const x of [b.x - b.width / 2, b.x + b.width / 2])
          for (const z of [b.z - b.depth / 2, b.z + b.depth / 2])
            expect(cityReserved(x, z)).toBe(false);
        for (const r of c.roads) {
          const across = r.axis === 'x' ? b.z : b.x,
            along = r.axis === 'x' ? b.x : b.z,
            halfAcross = (r.axis === 'x' ? b.depth : b.width) / 2,
            halfAlong = (r.axis === 'x' ? b.width : b.depth) / 2;
          expect(
            Math.abs(across - r.cross) < r.width / 2 + halfAcross &&
              along + halfAlong > r.from &&
              along - halfAlong < r.to,
          ).toBe(false);
        }
      }
      for (const t of c.trees) {
        expect(Math.abs(t.x) < 96 && t.z > -120 && t.z < 121).toBe(false);
        expect(t.x > 104 && t.x < 285 && t.z > -108 && t.z < 105).toBe(false);
        expect(
          c.buildings.some(
            (b) =>
              Math.abs(b.x - t.x) < b.width / 2 + 2.8 && Math.abs(b.z - t.z) < b.depth / 2 + 2.8,
          ),
        ).toBe(false);
      }
    }
  });
});
