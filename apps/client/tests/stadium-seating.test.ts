import { describe, expect, it } from 'vitest';
import { realStadiumSeats } from '../src/three/stadium-seating';
import { STADIUM_SKINS } from '../src/three/stadium-catalog';

describe('torcida nas arquibancadas de cada estádio', () => {
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
