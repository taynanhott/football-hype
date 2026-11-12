import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import {
  MINEIRAO_TIERS,
  MINEIRAO_SEGMENTS,
  MINEIRAO_PORTICOS,
  mineiraoPoint as pt,
} from './mineirao-layout';
type Point = [number, number, number];
export function Mineirao() {
  const meshes = useMemo(() => {
    const concrete: number[] = [],
      white: number[] = [],
      solar: number[] = [],
      dark: number[] = [],
      seatLight: number[] = [],
      seatMid: number[] = [],
      seatDark: number[] = [],
      lines: number[] = [];
    const quad = (v: number[], a: Point, b: Point, c: Point, d: Point) =>
      v.push(...a, ...b, ...c, ...b, ...d, ...c);
    const box = (v: number[], p: Point, s: Point) => {
      const ps = Array.from(
        { length: 8 },
        (_, i) => p.map((n, k) => n + ((i & (1 << k) ? 1 : -1) * s[k]!) / 2) as Point,
      );
      for (const [a, b, c, d] of [
        [0, 1, 2, 3],
        [4, 6, 5, 7],
        [0, 4, 1, 5],
        [2, 3, 6, 7],
        [0, 2, 4, 6],
        [1, 5, 3, 7],
      ])
        quad(v, ps[a!]!, ps[b!]!, ps[c!]!, ps[d!]!);
    };
    const beam = (v: number[], a: Point, b: Point, width: number) => {
      const d = new Vector3(...b).sub(new Vector3(...a)),
        len = d.length();
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
      const mid = new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5);
      const raw: number[] = [];
      box(raw, [0, 0, 0], [width, len, width]);
      for (let i = 0; i < raw.length; i += 3) {
        const p = new Vector3(raw[i]!, raw[i + 1]!, raw[i + 2]!).applyQuaternion(q).add(mid);
        v.push(p.x, p.y, p.z);
      }
    };
    const band = (
      v: number[],
      ix: number,
      iz: number,
      ox: number,
      oz: number,
      y: number,
      base?: number,
    ) => {
      for (let i = 0; i < MINEIRAO_SEGMENTS; i++) {
        const a = (i / MINEIRAO_SEGMENTS) * Math.PI * 2,
          b = ((i + 1) / MINEIRAO_SEGMENTS) * Math.PI * 2;
        const p = pt(a, ix, iz, y),
          q = pt(b, ix, iz, y),
          r = pt(a, ox, oz, y),
          s = pt(b, ox, oz, y);
        quad(v, p, q, r, s);
        if (base !== undefined) {
          quad(v, p, [p[0], base, p[2]], q, [q[0], base, q[2]]);
          quad(v, r, s, [r[0], base, r[2]], [s[0], base, s[2]]);
        }
      }
    };
    // Two broad, shallow tiers with a consistent closed riser on every row.
    for (const [tierIndex, tier] of MINEIRAO_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const y = tier.y + row * tier.rise;
        for (let i = 0; i < MINEIRAO_SEGMENTS; i++) {
          const a = (i / MINEIRAO_SEGMENTS) * Math.PI * 2,
            b = ((i + 1) / MINEIRAO_SEGMENTS) * Math.PI * 2;
          const p = pt(a, tier.x + row * tier.stepX, tier.z + row * tier.stepZ, y),
            q = pt(b, tier.x + row * tier.stepX, tier.z + row * tier.stepZ, y);
          const r = pt(a, tier.x + (row + 1) * tier.stepX, tier.z + (row + 1) * tier.stepZ, y),
            s = pt(b, tier.x + (row + 1) * tier.stepX, tier.z + (row + 1) * tier.stepZ, y);
          let hash = Math.imul(i + 1, 73856093) ^ Math.imul(row + 1, 19349663);
          hash = Math.imul(hash ^ (hash >>> 13), 83492791);
          const color = [seatLight, seatMid, seatDark][(hash >>> 0) % 3]!;
          const portal = tierIndex === 1 && row >= 5 && row < 10 && i % 22 === 8;
          quad(i % 11 === 0 ? concrete : portal ? dark : color, p, q, r, s);
          quad(
            i % 11 === 0 ? concrete : color,
            p,
            [p[0], row === 0 ? Math.max(0, tier.y - 2.88) : y - tier.rise, p[2]],
            q,
            [q[0], row === 0 ? Math.max(0, tier.y - 2.88) : y - tier.rise, q[2]],
          );
        }
      }
    band(concrete, 70.8, 87.4, 74, 90, 8.12, 0);
    band(dark, 72, 88, 74, 90, 10.8, 8.7);
    band(concrete, 97.4, 108.2, 104, 119, 21.75);
    band(dark, 98, 109, 104, 119, 24.2, 0);
    // Historic recessed galleries and the broad concrete crown.
    for (const [y, h] of [
      [3, 1.8],
      [8, 1.5],
      [13, 1.6],
      [25, 7],
    ])
      band(concrete, 103.8, 118.8, 106, 121, y!, y! - h!);
    band(concrete, 106, 121, 119, 135, 0.25);
    band(concrete, 50.4, 71.4, 51, 72, 0.12);
    const roof = (a: number, t: number): Point =>
      pt(a, 54 + 32 * t, 75 + 27 * t, 27.2 - 1.7 * t + 0.55 * Math.sin(Math.PI * t));
    // Continuous concrete deck under the solar strips closes the joint with the membrane roof.
    for (let i = 0; i < MINEIRAO_SEGMENTS; i++) {
      const a = (i / MINEIRAO_SEGMENTS) * Math.PI * 2,
        b = ((i + 1) / MINEIRAO_SEGMENTS) * Math.PI * 2;
      quad(
        concrete,
        pt(a, 86, 102, 24.1),
        pt(b, 86, 102, 24.1),
        pt(a, 110, 126, 26.75),
        pt(b, 110, 126, 26.75),
      );
      quad(white, roof(a, 1), roof(b, 1), pt(a, 86, 102, 24.1), pt(b, 86, 102, 24.1));
    }
    for (let i = 0; i < MINEIRAO_SEGMENTS; i++) {
      const a = (i / MINEIRAO_SEGMENTS) * Math.PI * 2,
        b = ((i + 1) / MINEIRAO_SEGMENTS) * Math.PI * 2;
      for (let k = 0; k < 12; k++)
        quad(white, roof(a, k / 12), roof(b, k / 12), roof(a, (k + 1) / 12), roof(b, (k + 1) / 12));
      const p = roof(a, 0),
        q = roof(b, 0);
      quad(white, p, q, [p[0], p[1] - 0.45, p[2]], [q[0], q[1] - 0.45, q[2]]);
    }
    // Massive radial concrete fins: inclined facade columns become tapered roof blades.
    for (let i = 0; i < MINEIRAO_PORTICOS; i++) {
      const a = (i / MINEIRAO_PORTICOS) * Math.PI * 2;
      const tangent: Point = [-Math.sin(a) * 0.36, 0, Math.cos(a) * 0.36];
      const outline = [
        pt(a, 101, 116, 0),
        pt(a, 107, 122, 0),
        pt(a, 114, 129, 29),
        pt(a, 87, 103, 24),
        pt(a, 99, 114, 22),
      ];
      const front = outline.map((p) => p.map((v, k) => v + tangent[k]!) as Point),
        back = outline.map((p) => p.map((v, k) => v - tangent[k]!) as Point);
      for (let j = 1; j < outline.length - 1; j++) {
        concrete.push(
          ...front[0]!,
          ...front[j]!,
          ...front[j + 1]!,
          ...back[0]!,
          ...back[j + 1]!,
          ...back[j]!,
        );
      }
      for (let j = 0; j < outline.length; j++) {
        const k = (j + 1) % outline.length;
        quad(concrete, front[j]!, back[j]!, front[k]!, back[k]!);
      }
      // Photovoltaic strips lie between the historic fins, with a visible cell grid.
      const start = a + 0.012,
        end = ((i + 1) / MINEIRAO_PORTICOS) * Math.PI * 2 - 0.012;
      const panel = (angle: number, t: number): Point =>
        pt(angle, 87 + 23 * t, 103 + 23 * t, 24.35 + 2.5 * t);
      for (let j = 0; j < 10; j++) {
        const t = j / 10,
          u = (j + 1) / 10;
        quad(solar, panel(start, t), panel(end, t), panel(start, u), panel(end, u));
        const p = panel(start, t),
          q = panel(end, t);
        p[1] += 0.035;
        q[1] += 0.035;
        beam(lines, p, q, 0.065);
      }
      for (let j = 0; j <= 3; j++) {
        const angle = start + ((end - start) * j) / 3,
          p = panel(angle, 0),
          q = panel(angle, 1);
        p[1] += 0.04;
        q[1] += 0.04;
        beam(lines, p, q, 0.07);
      }
      const p = roof(a, 0),
        q = roof(a, 1);
      p[1] += 0.03;
      q[1] += 0.03;
      beam(lines, p, q, 0.07);
    }
    for (const side of [-1, 1]) {
      box(dark, [0, 21.5, side * 98], [19, 7, 0.65]);
      // Broad entrance stairs descend from the outer promenade.
      for (let j = 0; j < 8; j++)
        box(concrete, [side * (108 + j * 1.5), 2 - j * 0.24, 0], [1.6, 0.5, 14]);
    }
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return [concrete, white, solar, dark, seatLight, seatMid, seatDark, lines].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group name="Mineirão — pórticos de concreto e anel solar">
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={
              [
                '#b5b09f',
                '#efeee5',
                '#344c67',
                '#303936',
                '#d4d8cf',
                '#a6b1ad',
                '#7a8b8b',
                '#a0aaa4',
              ][i]!
            }
            side={2}
            roughness={i === 2 ? 0.4 : 0.88}
            metalness={i === 2 ? 0.3 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}
