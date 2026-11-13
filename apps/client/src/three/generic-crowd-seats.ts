import { crowdNoise, type CrowdSeat } from './stadium-seating';

/** The same row coordinates used by the standard stand models. */
export function genericCrowdSeats(level: number): CrowdSeat[] {
  const rows = level >= 4 ? (level === 5 ? 13 : 10) : 5 + level * 2;
  const count = level >= 4 ? (level === 5 ? 3 : 2) * rows * 384 : 4 * rows * 100;
  return Array.from({ length: count }, (_, index) => {
    if (level >= 4) {
      const seat = index % 384,
        block = Math.floor(seat / 4);
      const angle = (block / 96) * Math.PI * 2,
        next = ((block + 1) / 96) * Math.PI * 2;
      const fraction = ((seat % 4) + 0.5 + (crowdNoise(index + 301) - 0.5) * 0.48) / 4;
      const row = Math.floor(index / 384) % rows,
        tier = Math.floor(index / (384 * rows));
      const distance = tier * 10 + row * 0.88;
      return {
        x: (Math.cos(angle) * (1 - fraction) + Math.cos(next) * fraction) * (51 + distance),
        z: (Math.sin(angle) * (1 - fraction) + Math.sin(next) * fraction) * (73 + distance),
        y: 2.05 + tier * 12 + row * 0.65,
        rotation: -Math.atan2(
          (73 + distance) * Math.cos(angle),
          -(51 + distance) * Math.sin(angle),
        ),
      };
    }
    const side = index % 4,
      row = Math.floor(index / 4) % rows,
      seat = Math.floor(index / (4 * rows));
    const along = (seat / 100 - 0.5) * (side < 2 ? 72 : 100);
    return {
      x: side < 2 ? along : (side === 2 ? 1 : -1) * (44 + row * 0.95),
      y: 2.1 + row * 0.7,
      z: side < 2 ? (side === 0 ? -1 : 1) * (62 + row * 0.95) : along,
      rotation: side < 2 ? 0 : Math.PI / 2,
    };
  });
}
