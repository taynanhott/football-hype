export type StandPoint = [number, number, number];
export const STAND_AISLE_WIDTH = 1.1;
export function aisleFraction(length: number) {
  return Math.min(0.5, STAND_AISLE_WIDTH / Math.max(0.001, length) / 2);
}
export function pushStandQuad(
  seats: number[],
  stairs: number[],
  a: StandPoint,
  b: StandPoint,
  c: StandPoint,
  d: StandPoint,
  aisle: boolean,
) {
  const quad = (v: number[], p: StandPoint, q: StandPoint, r: StandPoint, s: StandPoint) =>
    v.push(...p, ...q, ...r, ...q, ...s, ...r);
  if (!aisle) {
    quad(seats, a, b, c, d);
    return;
  }
  const half = aisleFraction(Math.hypot(b[0] - a[0], b[2] - a[2]));
  const lerp = (p: StandPoint, q: StandPoint, t: number): StandPoint => [
    p[0] + (q[0] - p[0]) * t,
    p[1] + (q[1] - p[1]) * t,
    p[2] + (q[2] - p[2]) * t,
  ];
  const lo = 0.5 - half,
    hi = 0.5 + half,
    al = lerp(a, b, lo),
    ah = lerp(a, b, hi),
    cl = lerp(c, d, lo),
    ch = lerp(c, d, hi);
  if (lo > 0) quad(seats, a, al, c, cl);
  quad(stairs, al, ah, cl, ch);
  if (hi < 1) quad(seats, ah, b, ch, d);
}
