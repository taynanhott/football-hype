export const MORUMBI_HEIGHT_SCALE = 0.68;

// Authoring dimensions; the shared public tiers below describe the rendered surfaces.
export const MORUMBI_MODEL_TIERS = [
  { rows: 12, x: 62, z: 82, step: 0.6, y: 1.2, rise: 0.46 },
  { rows: 12, x: 71, z: 91, step: 0.6, y: 9.2, rise: 0.46 },
  { rows: 38, x: 80, z: 100, step: 0.6, y: 17.2, rise: 0.59 },
];
export const MORUMBI_TIERS = MORUMBI_MODEL_TIERS.map((tier) => ({
  ...tier,
  y: tier.y * MORUMBI_HEIGHT_SCALE,
  rise: tier.rise * MORUMBI_HEIGHT_SCALE,
}));

export function morumbiPoint(a: number, x: number, z: number, y: number): [number, number, number] {
  return [
    x * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.85,
    y,
    z * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.85,
  ];
}
