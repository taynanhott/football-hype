export const MINEIRAO_TIERS = [
  { rows: 22, x: 51, z: 72, stepX: 0.9, stepZ: 0.7, y: 1.4, rise: 0.32 },
  { rows: 26, x: 74, z: 90, stepX: 0.9, stepZ: 0.7, y: 11, rise: 0.43 },
];
export const MINEIRAO_SEGMENTS = 264;
export const MINEIRAO_PORTICOS = 88;
export function mineiraoPoint(
  a: number,
  x: number,
  z: number,
  y: number,
): [number, number, number] {
  return [x * Math.cos(a), y, z * Math.sin(a)];
}
