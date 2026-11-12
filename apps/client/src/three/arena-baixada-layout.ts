export const BAIXADA_TIERS = [
  { rows: 16, front: 0, y: 1.5, rise: 0.52 },
  { rows: 18, front: 13, y: 13.5, rise: 0.62 },
];
/** Quarter circles meet the straight sides exactly; all sectors use these same joints. */
export function baixadaOutline(offset: number, y: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (const [sx, sz, reverse] of [
    [1, 1, 0],
    [-1, 1, 1],
    [-1, -1, 0],
    [1, -1, 1],
  ]) {
    for (let j = 0; j <= 12; j++) {
      const a = ((reverse ? 1 - j / 12 : j / 12) * Math.PI) / 2;
      points.push([
        sx! * (34 + Math.cos(a) * (6 + offset)),
        y,
        sz! * (53 + Math.sin(a) * (6 + offset)),
      ]);
    }
  }
  return points;
}
