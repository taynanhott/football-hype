import { describe, expect, it } from 'vitest';
import { levelTwoCrowdSeats, levelTwoOutline } from '../src/three/level-two-layout';
import { occupiedCrowdSeats } from '../src/three/stadium-seating';
describe('estádio genérico de nível 2', () => {
  it('preserva o campo livre e a torcida na arquibancada, com um setor mais baixo', () => {
    const seats = levelTwoCrowdSeats();
    expect(seats.length).toBeGreaterThan(1000);
    expect(seats.length).toBeLessThan(15000);
    expect(seats.every((s) => s.y > 1 && (Math.abs(s.x) > 34 || Math.abs(s.z) > 53))).toBe(true);
    const ends = seats.filter((s) => Math.abs(s.x) < 20);
    expect(Math.max(...ends.filter((s) => s.z > 0).map((s) => s.y))).toBeLessThan(6);
    expect(Math.max(...ends.filter((s) => s.z < 0).map((s) => s.y))).toBeGreaterThan(9);
    const occupied = occupiedCrowdSeats(seats, 0.6);
    expect(occupied.reduce((a, b) => a + b, 0)).toBe(Math.floor(seats.length * 0.6));
  });
  it('une os setores retos às curvas na mesma altura', () => {
    for (const f of [0, 0.25, 0.5, 1]) {
      const p = levelTwoOutline(f);
      for (const i of [16, 33, 50, 67]) {
        const a = p[i]!,
          b = p[(i + 1) % p.length]!;
        expect(a[1]).toBeCloseTo(b[1]);
        expect(Math.min(Math.abs(a[0] - b[0]), Math.abs(a[2] - b[2]))).toBeLessThan(1e-9);
      }
    }
  });
});
