export const MRV_TIERS = [
  { rows: 16, front: 0, step: 0.7, y: 4.4, rise: 0.42 },
  { rows: 3, front: 12.2, step: 0.7, y: 12, rise: 0.43 },
  { rows: 24, front: 15, step: 0.82, y: 15.5, rise: 0.5 },
];
export const MRV_SEGMENTS = 192;
export function mrvPoint(a: number, x: number, z: number, y: number): [number, number, number] {
  return [
    x * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.45,
    y,
    z * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.45,
  ];
}
