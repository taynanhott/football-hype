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
        expect(t.x > 173 && t.x < 355 && t.z > -120 && t.z < 120).toBe(false);
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

// Includes the roof overhang, not just the pitch or facade.
describe('complex access clearances', () => {
  it('keeps roads outside stadium and relocated training grounds', () => {
    const { roads } = createCityLayout(17);
    for (const [left, right, back, front] of [
      [-110, 110, -145, 145],
      [173, 355, -120, 120],
    ]) {
      for (const road of roads) {
        const half = road.width / 2 + 4;
        const x1 = road.axis === 'x' ? road.from : road.cross - half;
        const x2 = road.axis === 'x' ? road.to : road.cross + half;
        const z1 = road.axis === 'x' ? road.cross - half : road.from;
        const z2 = road.axis === 'x' ? road.cross + half : road.to;
        expect(x1 < right! && x2 > left! && z1 < front! && z2 > back!).toBe(false);
      }
    }
  });
});

describe('stadium landscaping', () => {
  it('keeps every tree crown outside the roof envelope', () => {
    for (const seed of [1, 17, 65535])
      for (const tree of createCityLayout(seed).trees) {
        const radius = tree.size;
        expect(Math.abs(tree.x) < 110 + radius && Math.abs(tree.z) < 145 + radius).toBe(false);
      }
  });
});
