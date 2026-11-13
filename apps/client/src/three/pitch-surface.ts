import type { Matrix4 } from 'three';

export const PITCH_SURFACE_Y = 0.12;

/** Lowest point of a transformed unit sphere (the boots are scaled ellipsoids). */
export function bootGroundLift(matrix: Matrix4): number {
  const e = matrix.elements;
  const soleY = e[13]! - Math.hypot(e[1]!, e[5]!, e[9]!);
  return Math.max(0, PITCH_SURFACE_Y - soleY);
}
