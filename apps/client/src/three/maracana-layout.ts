export const MARACANA_HEIGHT_SCALE = 0.72;

// Authoring dimensions; the shared public tiers below describe the rendered surfaces.
export const MARACANA_MODEL_TIERS = [
  { rows: 22, x: 51, z: 72, stepX: 0.85, stepZ: 0.65, y: 1.3, rise: 0.48 },
  { rows: 32, x: 72, z: 89, stepX: 0.9, stepZ: 0.7, y: 15, rise: 0.58 },
];
export const MARACANA_TIERS = MARACANA_MODEL_TIERS.map((tier) => ({
  ...tier,
  y: tier.y * MARACANA_HEIGHT_SCALE,
  rise: tier.rise * MARACANA_HEIGHT_SCALE,
}));

export const MARACANA_SEGMENTS = 192;
export function maracanaPoint(
  a: number,
  x: number,
  z: number,
  y: number,
): [number, number, number] {
  return [Math.cos(a) * x, y, Math.sin(a) * z];
}
