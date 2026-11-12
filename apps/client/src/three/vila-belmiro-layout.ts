export type VilaPoint = [number, number, number];
export const VILA_ROWS = 30;

/** Shared seams keep the bowl closed; the tall social stand ends at a short corner cheek. */
export function vilaOutline(progress: number, rear = false): VilaPoint[] {
  const points: VilaPoint[] = [];
  for (const [sx, sz, reverse] of [
    [1, 1, 0],
    [-1, 1, 1],
    [-1, -1, 0],
    [1, -1, 1],
  ]) {
    const sideX = sx === -1 ? 58.14 : 52.86;
    const endZ = sz === 1 ? 68.8 : 73.84;
    const sideRise = sx === -1 ? 18.56 : 10.5;
    const endRise = sz === 1 ? 7.5 : 11;
    for (let j = 0; j <= 16; j++) {
      const a = ((reverse ? 1 - j / 16 : j / 16) * Math.PI) / 2;
      const smoothBlend = Math.sin(a) ** 2;
      const cornerProgress = a / (Math.PI / 2);
      // Most of the curve belongs to the goal terrace, rather than a warped continuation of the tall side.
      const blend = rear ? smoothBlend : Math.min(1, cornerProgress / 0.125);
      const rx = 5 + (sideX - 39) * progress;
      const rz = 5 + (endZ - 58) * progress;
      const t = a / (Math.PI / 2);
      points.push([
        sx! * (rear ? 61 - 15 * t * t : 34 + Math.cos(a) * rx),
        Math.max(rear ? 12.2 : 0, 2.7 + progress * (sideRise * (1 - blend) + endRise * blend)),
        sz! * (rear ? 64 + 30 * t - 15 * t * t : 53 + Math.sin(a) * rz),
      ]);
    }
  }
  return points;
}

export function vilaAisles(segment: number): readonly number[] {
  return segment === 33 ? [0.12, 0.26, 0.4, 0.54, 0.68, 0.82, 0.94] : [0.24, 0.5, 0.76];
}
