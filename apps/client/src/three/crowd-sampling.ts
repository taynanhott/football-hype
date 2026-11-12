/** Fractional lengths carry population into short curves instead of rounding every bay to zero. */
export function segmentCrowdCount(length: number, spacing: number, a: readonly number[]): number {
  const seed =
    Math.imul(Math.round(a[0]! * 100), 73856093) ^
    Math.imul(Math.round(a[1]! * 100), 19349663) ^
    Math.imul(Math.round((a[2] ?? 0) * 100), 83492791);
  let n = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  const fraction = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  return Math.floor(length / spacing + fraction);
}
