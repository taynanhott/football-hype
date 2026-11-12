export const GREMIO_TIERS = [
  { rows: 18, front: 0, step: 0.72, y: 3.5, rise: 0.46 },
  { rows: 4, front: 13.8, step: 0.68, y: 15, rise: 0.5 },
  { rows: 26, front: 18, step: 0.86, y: 20, rise: 0.57 },
];
export const GREMIO_SEGMENTS = 192;
export function gremioPoint(
  a: number,
  x: number,
  z: number,
  y: number,
  exponent = 0.45,
): [number, number, number] {
  return [
    x * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** exponent,
    y,
    z * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** exponent,
  ];
}
