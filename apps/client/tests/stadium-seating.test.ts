import { NILTON_TIERS } from '../src/three/nilton-santos-layout';
import { MRV_TIERS } from '../src/three/arena-mrv-layout';
import { MINEIRAO_TIERS } from '../src/three/mineirao-layout';
import { GREMIO_TIERS } from '../src/three/arena-gremio-layout';
import { MARACANA_TIERS } from '../src/three/maracana-layout';
import { BAIXADA_TIERS } from '../src/three/arena-baixada-layout';
import { MORUMBI_TIERS } from '../src/three/morumbi-layout';
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
  it('acompanha as alturas diferentes das tribunas da Vila Belmiro', () => {
    const seats = realStadiumSeats('vila-belmiro');
    const lateral = seats.filter((s) => Math.abs(s.z) < 50);
    expect(Math.max(...lateral.filter((s) => s.x < 0).map((s) => s.y))).toBeCloseTo(21.685);
    expect(Math.max(...lateral.filter((s) => s.x > 0).map((s) => s.y))).toBeCloseTo(13.625);
    const ends = seats.filter((s) => Math.abs(s.x) < 30);
    expect(Math.max(...ends.filter((s) => s.z > 0).map((s) => s.y))).toBeLessThan(
      Math.max(...ends.filter((s) => s.z < 0).map((s) => s.y)),
    );
  });
  it('apoia a torcida da Baixada nos dois níveis sem ocupar a galeria entre eles', () => {
    const seats = realStadiumSeats('arena-baixada');
    const heights = BAIXADA_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
    expect(seats.some((s) => s.y > 10 && s.y < 13.5)).toBe(false);
    for (const tier of BAIXADA_TIERS)
      expect(
        seats.some((s) => Math.abs(s.y - (tier.y + (tier.rows - 1) * tier.rise + 0.425)) < 1e-8),
      ).toBe(true);
  });
  it('apoia a torcida do Maracanã nos dois níveis sem ocupar a galeria', () => {
    const seats = realStadiumSeats('maracana');
    const heights = MARACANA_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
    expect(seats.some((s) => s.y > 9 && s.y < 10.8)).toBe(false);
  });
  it('acompanha os três níveis da Arena do Grêmio sem ocupar as galerias', () => {
    const seats = realStadiumSeats('arena-gremio');
    const heights = GREMIO_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
    for (const tier of GREMIO_TIERS)
      expect(
        seats.some((s) => Math.abs(s.y - (tier.y + (tier.rows - 1) * tier.rise + 0.425)) < 1e-8),
      ).toBe(true);
    expect(seats.some((s) => s.y > 12 && s.y < 15)).toBe(false);
  });
  it('acompanha os dois níveis baixos do Mineirão sem ocupar a galeria', () => {
    const seats = realStadiumSeats('mineirao');
    const heights = MINEIRAO_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
    expect(seats.some((s) => s.y > 9 && s.y < 11)).toBe(false);
    expect(Math.max(...seats.map((s) => s.y))).toBeLessThan(23);
    for (const t of MINEIRAO_TIERS)
      expect((Math.atan(t.rise / Math.min(t.stepX, t.stepZ)) * 180) / Math.PI).toBeLessThan(32);
  });
  it('apoia a torcida da Arena MRV nos níveis de arquibancada e camarotes', () => {
    const seats = realStadiumSeats('arena-mrv');
    const heights = MRV_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
    for (const tier of MRV_TIERS)
      expect(
        seats.some((s) => Math.abs(s.y - (tier.y + (tier.rows - 1) * tier.rise + 0.425)) < 1e-8),
      ).toBe(true);
    expect(Math.max(...seats.map((s) => s.y))).toBeLessThan(28);
  });
  it('posiciona a torcida do Nilton Santos nos dois níveis sem ocupar a pista', () => {
    const seats = realStadiumSeats('nilton-santos');
    const heights = NILTON_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) {
      expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
      expect(
        (Math.abs(seat.x) / NILTON_TIERS[0]!.x) ** (2 / 0.7) +
          (Math.abs(seat.z) / NILTON_TIERS[0]!.z) ** (2 / 0.7),
      ).toBeGreaterThanOrEqual(1);
    }
    expect(seats.some((s) => s.y > 9 && s.y < 12)).toBe(false);
  });
  it('mantém a torcida do Morumbi nas superfícies dos três níveis', () => {
    const seats = realStadiumSeats('morumbi');
    const heights = MORUMBI_TIERS.flatMap((t) =>
      Array.from({ length: t.rows }, (_, r) => t.y + r * t.rise + 0.425),
    );
    for (const seat of seats) expect(heights.some((y) => Math.abs(y - seat.y) < 1e-8)).toBe(true);
    for (const tier of MORUMBI_TIERS)
      expect(
        seats.some((s) => Math.abs(s.y - (tier.y + (tier.rows - 1) * tier.rise + 0.425)) < 1e-8),
      ).toBe(true);
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
