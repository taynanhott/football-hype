export type CrowdSeat = { x: number; y: number; z: number; rotation: number };

export function crowdNoise(seed: number): number {
  let n = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Stable small groups, with an exact attendance count and no modular stripes. */
export function occupiedCrowdSeats(seats: readonly CrowdSeat[], occupancy: number): Uint8Array {
  const count = Math.floor(
    seats.length * (Number.isFinite(occupancy) ? Math.max(0, Math.min(1, occupancy)) : 0),
  );
  const result = new Uint8Array(seats.length);
  if (count === 0) return result;
  if (count === seats.length) return result.fill(1);
  const ranked = seats
    .map((seat, index) => {
      const group =
        Math.imul(Math.floor(seat.x / 7), 73856093) ^
        Math.imul(Math.floor(seat.z / 7), 19349663) ^
        Math.imul(Math.floor(seat.y / 3), 83492791);
      return { index, rank: crowdNoise(group) * 0.35 + crowdNoise(index + 17) * 0.65 };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  for (let i = 0; i < count; i++) result[ranked[i]!.index] = 1;
  return result;
}

/** Sample the actual tread surfaces, including the 64 flat segments of each Ribbon.
 * Keep this map in stadium coordinates, independently of facility upgrade level. */
export function realStadiumSeats(skin: string): CrowdSeat[] {
  const seats: CrowdSeat[] = [];
  const add = (x: number, surface: number, z: number) => {
    seats.push({ x, y: surface + 0.425, z, rotation: Math.atan2(-x, -z) });
  };
  const straight = (side: number, radius: number, surface: number, length: number, end = false) => {
    const count = Math.floor(length / 1.35);
    for (let i = 0; i < count; i++) {
      if (i % 24 === 0) continue;
      const along = ((i + 0.5) / count - 0.5) * length + Math.sin(surface * 17.3) * 0.3;
      add(end ? along : side * radius, surface, end ? side * radius : along);
    }
  };
  const ring = (x: number, z: number, y: number, rect = false, start = 0, end = Math.PI * 2) => {
    const point = (a: number): [number, number] => [
      x * Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), rect ? 0.45 : 1),
      z * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), rect ? 0.45 : 1),
    ];
    for (let block = 0; block < 64; block++) {
      const a = point(start + (block / 64) * (end - start));
      const b = point(start + ((block + 1) / 64) * (end - start));
      const count = Math.max(
        1,
        Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / (skin === 'morumbi' ? 1.95 : 1.7)),
      );
      for (let i = 0; i < count; i++) {
        const f = (i + 0.5) / count;
        add(a[0] + (b[0] - a[0]) * f, y, a[1] + (b[1] - a[1]) * f);
      }
    }
  };
  if (skin === 'neo-quimica') {
    for (const side of [-1, 1]) {
      for (let r = 0; r < 32; r++)
        if (r % 8 !== 0) straight(side, 40 + r * 0.75, 1.4 + r * 0.7, 114);
      for (let r = 0; r < 21; r++)
        if (r % 7 !== 0) straight(side, 60 + r * 0.8, 1.35 + r * 0.6, 79, true);
    }
  } else if (skin === 'sao-januario') {
    for (let r = 0; r < 24; r++) {
      const x = 46 + r * 0.8,
        z = 79 + r * 0.8,
        y = 1 + r * 0.48;
      for (const side of [-1, 1]) straight(side, x, y + 0.325, 116);
      ring(x + 0.425, z + 0.425, y, false, Math.PI, Math.PI * 2);
    }
  } else if (skin === 'vila-belmiro' || skin === 'arena-baixada') {
    for (let r = 0; r < (skin === 'arena-baixada' ? 30 : 22); r++) {
      for (const side of [-1, 1]) {
        straight(side, 40 + r * 0.72, 1.325 + r * 0.58, 116);
        straight(side, 59 + r * 0.72, 1.325 + r * 0.58, 79, true);
      }
    }
  } else if (skin === 'morumbi') {
    for (let tier = 0; tier < 3; tier++)
      for (let r = 1; r < 19; r++) {
        const d = tier * 16 + r * 0.75;
        ring(54.425 + d, 79.425 + d, 1 + tier * 12 + r * 0.55);
      }
  } else if (skin === 'palmeiras-park') {
    for (let tier = 0; tier < 2; tier++)
      for (let r = 0; r < 20; r++) {
        if (r % 8 === 0) continue;
        const d = tier * 17 + r * 0.7;
        ring(41.4 + d, 61.4 + d, 1 + tier * 14 + r * 0.6, true);
      }
  } else {
    const rect = skin === 'arena-mrv';
    const circular = ['maracana', 'mineirao', 'beira-rio'].includes(skin);
    const frontX = rect ? 41 : skin === 'nilton-santos' ? 58 : 51;
    const frontZ = rect ? 61 : skin === 'nilton-santos' ? 85 : 77;
    for (let tier = 0; tier < 2; tier++)
      for (let r = 1; r < 20; r++) {
        const d = tier * 18 + r * 0.76 + 0.4;
        ring(
          frontX + d * (circular ? 1.5 : 1),
          frontZ + d * (circular ? 0.7 : 1),
          1 + r * 0.57 + tier * 15,
          rect,
        );
      }
  }
  return seats;
}
