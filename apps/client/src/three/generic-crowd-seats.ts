import { crowdNoise, type CrowdSeat } from './stadium-seating';

/** The same row coordinates used by the standard stand models. */
export function genericCrowdSeats(level: number): CrowdSeat[] {
  if (level < 4) {
    const seats: CrowdSeat[] = [];
    const rows = 5 + level * 2;
    for (let tier = 0; tier < (level === 3 ? 2 : 1); tier++)
      for (let side = 0; side < 4; side++)
        for (let row = 0; row < rows; row++) {
          const width = side < 2 ? 78 : 110;
          const count = Math.floor(width / 0.8);
          // Each 2m box overlaps the next row by 1.05m: use the exposed front tread.
          const outward =
            (side < 2 ? 63 * (tier ? 1.08 : 1) : 45 * (tier ? 1.12 : 1)) + row * 0.95 - 0.525;
          for (let seat = 0; seat < count; seat++) {
            const along = ((seat + 0.5) / count - 0.5) * width;
            seats.push({
              x: side < 2 ? along : (side === 2 ? 1 : -1) * outward,
              y: tier * 10 + 1.6 + row * 0.7 + 0.425,
              z: side < 2 ? (side === 0 ? -1 : 1) * outward : along,
              rotation:
                side === 0 ? 0 : side === 1 ? Math.PI : side === 2 ? -Math.PI / 2 : Math.PI / 2,
            });
          }
        }
    return seats;
  }
  const rows = level === 5 ? 13 : 10;
  const count = (level === 5 ? 3 : 2) * rows * 384;
  return Array.from({ length: count }, (_, index) => {
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
      y: 1.975 + tier * 12 + row * 0.65,
      rotation: -Math.atan2((73 + distance) * Math.cos(angle), -(51 + distance) * Math.sin(angle)),
    };
  });
}
