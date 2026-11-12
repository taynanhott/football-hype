import { STAND_AISLE_WIDTH } from './stand-aisle';
import { segmentCrowdCount } from './crowd-sampling';
import { NILTON_TIERS, NILTON_SEGMENTS, niltonPoint } from './nilton-santos-layout';
import { MRV_TIERS, MRV_SEGMENTS, mrvPoint } from './arena-mrv-layout';
import {
  SAO_JANUARIO_ROWS,
  SAO_JANUARIO_STEP,
  saoJanuarioOutline,
  saoJanuarioHeight,
} from './sao-januario-layout';
import { MINEIRAO_TIERS, MINEIRAO_SEGMENTS, mineiraoPoint } from './mineirao-layout';
import { GREMIO_TIERS, GREMIO_SEGMENTS, gremioPoint } from './arena-gremio-layout';
import { MARACANA_TIERS, MARACANA_SEGMENTS, maracanaPoint } from './maracana-layout';
import { BAIXADA_TIERS, baixadaOutline } from './arena-baixada-layout';
import { MORUMBI_TIERS, morumbiPoint } from './morumbi-layout';
import { vilaOutline, vilaAisles, VILA_ROWS } from './vila-belmiro-layout';
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
  const add = (x: number, surface: number, z: number, rotation = Math.atan2(-x, -z)) => {
    if (Math.abs(x) <= 34 && Math.abs(z) <= 53) return;
    seats.push({ x, y: surface + 0.425, z, rotation });
  };
  const straight = (side: number, radius: number, surface: number, length: number, end = false) => {
    const count = Math.floor(length / 1.35);
    for (let i = 0; i < count; i++) {
      if (i % 24 === 0) continue;
      const along =
        ((i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count - 0.5) * length +
        Math.sin(surface * 17.3) * 0.3;
      add(
        end ? along : side * radius,
        surface,
        end ? side * radius : along,
        end ? (side === 1 ? Math.PI : 0) : (-side * Math.PI) / 2,
      );
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
        const f = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
        add(
          a[0] + (b[0] - a[0]) * f,
          y,
          a[1] + (b[1] - a[1]) * f,
          Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        );
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
    for (let row = 0; row < SAO_JANUARIO_ROWS; row++) {
      const outline = saoJanuarioOutline((row + 0.5) * SAO_JANUARIO_STEP, saoJanuarioHeight(row));
      for (let i = 0; i < outline.length - 1; i++) {
        const a = outline[i]!,
          b = outline[i + 1]!;
        const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.7, a);
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
          add(
            a[0] + (b[0] - a[0]) * t,
            a[1],
            a[2] + (b[2] - a[2]) * t,
            Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
          );
        }
      }
    }
  } else if (skin === 'vila-belmiro') {
    for (let r = 0; r < VILA_ROWS; r++) {
      const outline = vilaOutline(r / (VILA_ROWS - 1));
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i]!,
          b = outline[(i + 1) % outline.length]!;
        const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.7, a);
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
          if (i % 17 === 16 && vilaAisles(i).some((aisle) => Math.abs(t - aisle) < 0.018)) continue;
          add(
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
            Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
          );
        }
      }
    }
  } else if (skin === 'arena-baixada') {
    for (const tier of BAIXADA_TIERS)
      for (let r = 0; r < tier.rows; r++) {
        const outline = baixadaOutline(tier.front + (r + 0.5) * 0.72, tier.y + r * tier.rise);
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i]!,
            b = outline[(i + 1) % outline.length]!;
          const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.7, a);
          for (let j = 0; j < count; j++) {
            const t = (j + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            if (i % 13 === 12 && [0.18, 0.39, 0.61, 0.82].some((v) => Math.abs(t - v) < 0.017))
              continue;
            add(
              a[0] + (b[0] - a[0]) * t,
              a[1],
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
      }
  } else if (skin === 'maracana') {
    for (const [tierIndex, tier] of MARACANA_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const x = tier.x + (row + 0.5) * tier.stepX,
          z = tier.z + (row + 0.5) * tier.stepZ,
          y = tier.y + row * tier.rise;
        for (let block = 0; block < MARACANA_SEGMENTS; block++) {
          if (block % 8 === 0 || (tierIndex === 1 && row >= 10 && row < 14 && block % 16 === 5))
            continue;
          const a = maracanaPoint((block / MARACANA_SEGMENTS) * Math.PI * 2, x, z, y),
            b = maracanaPoint(((block + 1) / MARACANA_SEGMENTS) * Math.PI * 2, x, z, y);
          const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.95, a);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            add(
              a[0] + (b[0] - a[0]) * t,
              y,
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
      }
  } else if (skin === 'arena-gremio') {
    for (const [tierIndex, tier] of GREMIO_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const d = tier.front + (row + 0.5) * tier.step,
          y = tier.y + row * tier.rise;
        for (let block = 0; block < GREMIO_SEGMENTS; block++) {
          if (tierIndex === 2 && row >= 9 && row < 13 && block % 16 === 5) continue;
          const a = gremioPoint((block / GREMIO_SEGMENTS) * Math.PI * 2, 40 + d, 59 + d, y),
            b = gremioPoint(((block + 1) / GREMIO_SEGMENTS) * Math.PI * 2, 40 + d, 59 + d, y);
          const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.8, a);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            if (
              block % 8 === 0 &&
              Math.abs(t - 0.5) * Math.hypot(b[0] - a[0], b[2] - a[2]) < STAND_AISLE_WIDTH / 2 + 0.4
            )
              continue;
            add(
              a[0] + (b[0] - a[0]) * t,
              y,
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
      }
  } else if (skin === 'mineirao') {
    for (const [tierIndex, tier] of MINEIRAO_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const x = tier.x + (row + 0.5) * tier.stepX,
          z = tier.z + (row + 0.5) * tier.stepZ,
          y = tier.y + row * tier.rise;
        for (let block = 0; block < MINEIRAO_SEGMENTS; block++) {
          if (block % 11 === 0 || (tierIndex === 1 && row >= 5 && row < 10 && block % 22 === 8))
            continue;
          const a = mineiraoPoint((block / MINEIRAO_SEGMENTS) * Math.PI * 2, x, z, y),
            b = mineiraoPoint(((block + 1) / MINEIRAO_SEGMENTS) * Math.PI * 2, x, z, y);
          const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.8, a);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            add(
              a[0] + (b[0] - a[0]) * t,
              y,
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
      }
  } else if (skin === 'arena-mrv') {
    for (const [tierIndex, tier] of MRV_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const d = tier.front + (row + 0.5) * tier.step,
          y = tier.y + row * tier.rise;
        for (let block = 0; block < MRV_SEGMENTS; block++) {
          if (tierIndex === 2 && row >= 6 && row < 10 && block % 16 === 5) continue;
          const a = mrvPoint((block / MRV_SEGMENTS) * Math.PI * 2, 41 + d, 61 + d, y),
            b = mrvPoint(((block + 1) / MRV_SEGMENTS) * Math.PI * 2, 41 + d, 61 + d, y);
          const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.8, a);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            if (
              block % 8 === 0 &&
              Math.abs(t - 0.5) * Math.hypot(b[0] - a[0], b[2] - a[2]) < STAND_AISLE_WIDTH / 2 + 0.4
            )
              continue;
            add(
              a[0] + (b[0] - a[0]) * t,
              y,
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
      }
  } else if (skin === 'nilton-santos') {
    for (const [tierIndex, tier] of NILTON_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const x = tier.x + (row + 0.5) * tier.stepX,
          z = tier.z + (row + 0.5) * tier.stepZ,
          y = tier.y + row * tier.rise;
        for (let block = 0; block < NILTON_SEGMENTS; block++) {
          if (block % 16 === 0 || (tierIndex === 1 && row >= 6 && row < 10 && block % 32 === 10))
            continue;
          const a = niltonPoint((block / NILTON_SEGMENTS) * Math.PI * 2, x, z, y),
            b = niltonPoint(((block + 1) / NILTON_SEGMENTS) * Math.PI * 2, x, z, y),
            count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 1.95, a);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            add(
              a[0] + (b[0] - a[0]) * t,
              y,
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
      }
  } else if (skin === 'morumbi') {
    for (const tier of MORUMBI_TIERS)
      for (let row = 0; row < tier.rows; row++) {
        const d = (row + 0.5) * tier.step,
          y = tier.y + row * tier.rise;
        for (let block = 0; block < 192; block++) {
          if (block % 12 === 0) continue;
          const a = morumbiPoint((block / 192) * Math.PI * 2, tier.x + d, tier.z + d, y);
          const b = morumbiPoint(((block + 1) / 192) * Math.PI * 2, tier.x + d, tier.z + d, y);
          const count = segmentCrowdCount(Math.hypot(b[0] - a[0], b[2] - a[2]), 2.4, a);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5 + (crowdNoise(seats.length + 301) - 0.5) * 0.6) / count;
            add(
              a[0] + (b[0] - a[0]) * t,
              y,
              a[2] + (b[2] - a[2]) * t,
              Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
            );
          }
        }
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
