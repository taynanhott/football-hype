import { describe, expect, it } from 'vitest';
import { realStadiumSeats, occupiedCrowdSeats } from '../src/three/stadium-seating';
import { STADIUM_SKINS } from '../src/three/stadium-catalog';

describe('torcida nas arquibancadas de cada estádio', () => {
  it('dispersa a ocupação sem faixas periódicas e preserva o público solicitado', () => {
    const seats = realStadiumSeats('arena-baixada');
    for (const occupancy of [0, 0.18, 0.44, 0.73, 0.97, 1]) {
      const occupied = occupiedCrowdSeats(seats, occupancy);
      expect(occupied.reduce((sum, value) => sum + value, 0)).toBe(
        Math.floor(seats.length * occupancy),
      );
      expect(occupiedCrowdSeats(seats, occupancy)).toEqual(occupied);
    }
    const occupied = occupiedCrowdSeats(seats, 0.5);
    let changes = 0;
    for (let i = 1; i < occupied.length; i++) if (occupied[i] !== occupied[i - 1]) changes++;
    expect(changes).toBeGreaterThan(seats.length * 0.25);
    expect(occupiedCrowdSeats(seats, 0.73).every((value, i) => !occupied[i] || value === 1)).toBe(
      true,
    );
  });
  it.each(STADIUM_SKINS)(
    '%s tem assentos fora do campo e respeita o limite de instâncias',
    (skin) => {
      const seats = realStadiumSeats(skin);
      expect(seats.length).toBeGreaterThan(1000);
      expect(seats.length).toBeLessThan(15000);
      expect(
        seats.every(
          (s) =>
            Number.isFinite(s.rotation) && s.y > 1 && (Math.abs(s.x) > 34 || Math.abs(s.z) > 53),
        ),
      ).toBe(true);
    },
  );
  it('mantém vazio o lado aberto de São Januário', () => {
    expect(realStadiumSeats('sao-januario').every((s) => s.z < 58)).toBe(true);
  });
  it('apoia os torcedores nas superfícies das fileiras da Neo Química', () => {
    for (const s of realStadiumSeats('neo-quimica')) {
      const side = Math.abs(s.x) >= 40;
      const row = side ? (Math.abs(s.x) - 40) / 0.75 : (Math.abs(s.z) - 60) / 0.8;
      const surface = side ? 1.4 + row * 0.7 : 1.35 + row * 0.6;
      expect(s.y - 0.425).toBeCloseTo(surface, 8);
    }
  });
});
