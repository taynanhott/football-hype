import { segmentCrowdCount } from './crowd-sampling';
import { crowdNoise } from './stadium-seating';
export const LEVEL_TWO_ROWS = 28;
export type LevelTwoPoint = [number, number, number];
/** Continuous oval-rectangle terraces, with a low southern goal end. */
export function levelTwoOutline(progress: number, rear = false): LevelTwoPoint[] {
  const points: LevelTwoPoint[] = [];
  for (const [sx, sz, reverse] of [
    [1, 1, 0],
    [-1, 1, 1],
    [-1, -1, 0],
    [1, -1, 1],
  ])
    for (let j = 0; j <= 16; j++) {
      const a = ((reverse ? 1 - j / 16 : j / 16) * Math.PI) / 2,
        blend = Math.sin(a) ** 2;
      const rise = 11.2 * (1 - blend) + (sz === 1 ? 3.6 : 8.1) * blend;
      points.push([
        sx! * (29 + Math.cos(a) * (rear ? 37 : 11 + 22 * progress)),
        1.2 + progress * rise,
        sz! * (45 + Math.sin(a) * (rear ? 41 : 15 + 22 * progress)),
      ]);
    }
  return points;
}
export function levelTwoCrowdSeats() {
  const seats: { x: number; y: number; z: number; rotation: number }[] = [];
  for (let row = 0; row < LEVEL_TWO_ROWS; row++) {
    const outline = levelTwoOutline(row / (LEVEL_TWO_ROWS - 1));
    for (let i = 0; i < outline.length; i++) {
      if (i % 17 === 8) continue;
      const a = outline[i]!,
        b = outline[(i + 1) % outline.length]!,
        count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.6, a);
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
        if (i % 17 === 16 && [0.2, 0.4, 0.6, 0.8].some((aisle) => Math.abs(t - aisle) < 0.016))
          continue;
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[2] + (b[2] - a[2]) * t;
        seats.push({
          x,
          y: a[1] + (b[1] - a[1]) * t + 0.425,
          z,
          rotation: Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
        });
      }
    }
  }
  return seats;
}
