import { describe, it, expect } from 'vitest';
import { realStadiumSeats } from '../src/three/stadium-seating';
import { levelTwoCrowdSeats } from '../src/three/level-two-layout';
import { pushStandQuad, STAND_AISLE_WIDTH } from '../src/three/stand-aisle';
describe('cobertura das curvas e das junções', () => {
  it.each([
    'maracana',
    'mineirao',
    'arena-mrv',
    'arena-gremio',
    'nilton-santos',
    'vila-belmiro',
    'arena-baixada',
    'level-two',
  ])('%s mantém torcida em todas as direções, inclusive no nível inferior', (skin) => {
    const all = skin === 'level-two' ? levelTwoCrowdSeats() : realStadiumSeats(skin),
      min = Math.min(...all.map((s) => s.y));
    const seats = all.filter((s) => s.y < min + 4.5),
      bins = Array<number>(24).fill(0);
    for (const s of seats)
      bins[Math.floor(((Math.atan2(s.z, s.x) + Math.PI) / (2 * Math.PI)) * 24) % 24]!++;
    expect(Math.min(...bins)).toBeGreaterThan(4);
    expect(all.length).toBeLessThan(15000);
  });
  it('limita a escada a 1,1m mesmo quando o trecho tem vinte metros', () => {
    const seats: number[] = [],
      stairs: number[] = [];
    pushStandQuad(seats, stairs, [0, 3, 0], [20, 3, 0], [0, 3, 1], [20, 3, 1], true);
    const x = stairs.filter((_, i) => i % 3 === 0);
    expect(Math.max(...x) - Math.min(...x)).toBeCloseTo(STAND_AISLE_WIDTH);
    expect(seats.length).toBe(36);
  });
});
