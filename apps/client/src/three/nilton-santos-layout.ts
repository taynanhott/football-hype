export const NILTON_PLAN_SCALE = 0.92;
export const NILTON_MODEL_TIERS = [
  { rows: 18, x: 58, z: 85, stepX: 0.9, stepZ: 0.7, y: 1.5, rise: 0.4 },
  { rows: 26, x: 77, z: 102, stepX: 0.75, stepZ: 0.6, y: 12, rise: 0.5 },
];
// Actual rendered tread coordinates, shared with the crowd placement.
export const NILTON_TIERS = NILTON_MODEL_TIERS.map((tier) => ({
  ...tier,
  x: tier.x * NILTON_PLAN_SCALE,
  z: tier.z * NILTON_PLAN_SCALE,
  stepX: tier.stepX * NILTON_PLAN_SCALE,
  stepZ: tier.stepZ * NILTON_PLAN_SCALE,
}));

export const NILTON_SEGMENTS = 384;
export function niltonPoint(a: number, x: number, z: number, y: number): [number, number, number] {
  return [
    x * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7,
    y,
    z * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7,
  ];
}
const GLYPHS: Record<string, readonly string[]> = {
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
};
export function niltonLetter(a: number, row: number): boolean {
  const side = Math.cos(a) >= 0 ? 0 : Math.PI,
    angle = Math.atan2(Math.sin(a - side), Math.cos(a - side));
  const col = Math.floor(((angle + 0.76) / 1.52) * 47),
    line = 6 - Math.floor((row - 3) / 3);
  if (col < 0 || col >= 47 || line < 0 || line > 6) return false;
  const letter = 'BOTAFOGO'[Math.floor(col / 6)],
    x = col % 6;
  return x < 5 && !!letter && GLYPHS[letter]?.[line]?.[x] === '1';
}
