import { describe, it, expect } from 'vitest';
import { flareOrigins, visitorCrowdSeat } from '../src/three/flare-layout';
import { realStadiumSeats } from '../src/three/stadium-seating';
describe('sinalizadores nas torcidas', () => {
  const seats = realStadiumSeats('maracana');
  it('preenche uma quantidade maior e mantém alternativas sob cobertura baixa', () => {
    expect(flareOrigins(seats, '#f00', '#0f0', 20)).toHaveLength(20);
    const sheltered = flareOrigins(seats, '#f00', '#0f0', 20, () => 0.12);
    expect(sheltered).toHaveLength(20);
    expect(sheltered.every((s) => s.travel === 0.12)).toBe(true);
    expect(flareOrigins(seats, '#f00', '#0f0', 20, () => 0)).toHaveLength(0);
  });
  it('respeita as cores dos dois grupos e limita o total de plumas', () => {
    const origins = flareOrigins(seats, '#ff2233', '#2255ff', 9);
    expect(origins).toHaveLength(9);
    expect(origins.some(visitorCrowdSeat)).toBe(true);
    expect(origins.some((s) => !visitorCrowdSeat(s))).toBe(true);
    for (const s of origins) expect(s.color).toBe(visitorCrowdSeat(s) ? '#2255ff' : '#ff2233');
    expect(flareOrigins(seats, '#ff2233', '#2255ff', 5)).toHaveLength(5);
  });
  it('varia a altura, acompanha a subida e não cria pontos sobrepostos', () => {
    const origins = flareOrigins(seats, '#ff2233', '#2255ff', 9);
    expect(
      Math.max(...origins.map((s) => s.y)) - Math.min(...origins.map((s) => s.y)),
    ).toBeGreaterThan(8);
    for (const [i, s] of origins.entries()) {
      expect(s.flow[1]).toBe(1);
      expect(s.x * s.flow[0] + s.z * s.flow[2]).toBeGreaterThan(0);
      for (const other of origins.slice(i + 1))
        expect(Math.hypot(s.x - other.x, s.z - other.z)).toBeGreaterThanOrEqual(13);
    }
    expect(flareOrigins(seats, '#ff2233', '#2255ff', 9)).toEqual(origins);
  });
});
