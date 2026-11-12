import { ShapeUtils, Vector2 } from 'three';
import { SAO_JANUARIO_STEP, saoJanuarioHeight } from './sao-januario-layout';
type P = [number, number];
// Four flared arms with shallow V notches; coordinates are independent of the seat grid.
export const VASCO_CROSS: readonly P[] = [
  [0, 0.83],
  [0.64, 1],
  [0.23, 0.23],
  [1, 0.64],
  [0.83, 0],
  [1, -0.64],
  [0.23, -0.23],
  [0.64, -1],
  [0, -0.83],
  [-0.64, -1],
  [-0.23, -0.23],
  [-1, -0.64],
  [-0.83, 0],
  [-1, 0.64],
  [-0.23, 0.23],
  [-0.64, 1],
];
function clip(poly: P[], edge: number, above: boolean): P[] {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!,
      b = poly[(i + 1) % poly.length]!,
      insideA = above ? a[1] >= edge : a[1] <= edge,
      insideB = above ? b[1] >= edge : b[1] <= edge;
    if (insideA) out.push(a);
    if (insideA !== insideB) {
      const t = (edge - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, edge]);
    }
  }
  return out;
}
export function vascoCrossVertices(): number[] {
  const outline = VASCO_CROSS.map(([x, y]) => new Vector2(x, y));
  const faces = ShapeUtils.triangulateShape(outline, []),
    vertices: number[] = [];
  const point = (p: P, y: number): number[] => {
    const angle = Math.PI * 1.5 + (p[0] * 8.5) / 45,
      segment = ((angle - Math.PI) / Math.PI) * 64;
    const lo = Math.floor(segment),
      t = segment - lo,
      a = Math.PI + (lo / 64) * Math.PI,
      b = Math.PI + ((lo + 1) / 64) * Math.PI;
    const offset = p[1] * SAO_JANUARIO_STEP;
    return [
      (42 + offset) * (Math.cos(a) + (Math.cos(b) - Math.cos(a)) * t),
      y,
      -40 + (35 + offset) * (Math.sin(a) + (Math.sin(b) - Math.sin(a)) * t),
    ];
  };
  for (const face of faces) {
    const triangle = face.map((i) => {
      const p = outline[i]!;
      return [p.x, 17.5 + p.y * 9.5] as P;
    });
    for (let row = 8; row < 27; row++) {
      const poly = clip(clip(triangle, row, true), row + 1, false),
        y = saoJanuarioHeight(row) + 0.018;
      for (let i = 1; i < poly.length - 1; i++)
        vertices.push(...point(poly[0]!, y), ...point(poly[i]!, y), ...point(poly[i + 1]!, y));
      // Paint the vertical face too, avoiding white horizontal gaps through the emblem.
      const xs: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i]!,
          b = triangle[(i + 1) % 3]!;
        if ((a[1] <= row && b[1] > row) || (b[1] <= row && a[1] > row)) {
          const t = (row - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + (b[0] - a[0]) * t);
        }
      }
      if (xs.length === 2) {
        const a: P = [Math.min(...xs), row - 0.012],
          b: P = [Math.max(...xs), row - 0.012],
          lo = saoJanuarioHeight(row - 1) + 0.018;
        vertices.push(
          ...point(a, y),
          ...point(b, y),
          ...point(a, lo),
          ...point(b, y),
          ...point(b, lo),
          ...point(a, lo),
        );
      }
    }
  }
  return vertices;
}
