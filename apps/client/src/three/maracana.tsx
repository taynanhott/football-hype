import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import {
  MARACANA_MODEL_TIERS as MARACANA_TIERS,
  MARACANA_HEIGHT_SCALE,
  MARACANA_SEGMENTS,
  maracanaPoint as pt,
} from './maracana-layout';
type Point = [number, number, number];
export function Maracana() {
  const meshes = useMemo(() => {
    const concrete: number[] = [],
      blue: number[] = [],
      white: number[] = [],
      yellow: number[] = [],
      green: number[] = [],
      frame: number[] = [],
      dark: number[] = [];
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
    const ring = (
      v: number[],
      ix: number,
      iz: number,
      ox: number,
      oz: number,
      y: number,
      base?: number,
    ) => {
      for (let i = 0; i < MARACANA_SEGMENTS; i++) {
        const a = (i / MARACANA_SEGMENTS) * Math.PI * 2,
          b = ((i + 1) / MARACANA_SEGMENTS) * Math.PI * 2;
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
    // Continuous closed oval stands, preserving a wide gallery between the two tiers.
    for (const [tierIndex, tier] of MARACANA_TIERS.entries()) {
      for (let row = 0; row < tier.rows; row++) {
        const y = tier.y + row * tier.rise;
        for (let i = 0; i < MARACANA_SEGMENTS; i++) {
          const a = (i / MARACANA_SEGMENTS) * Math.PI * 2,
            b = ((i + 1) / MARACANA_SEGMENTS) * Math.PI * 2;
          const p = pt(a, tier.x + row * tier.stepX, tier.z + row * tier.stepZ, y);
          const q = pt(b, tier.x + row * tier.stepX, tier.z + row * tier.stepZ, y);
          const r = pt(a, tier.x + (row + 1) * tier.stepX, tier.z + (row + 1) * tier.stepZ, y);
          const s = pt(b, tier.x + (row + 1) * tier.stepX, tier.z + (row + 1) * tier.stepZ, y);
          const sector = Math.floor(i / 24);
          const color =
            tierIndex === 0
              ? blue
              : sector === 1 || sector === 5
                ? yellow
                : sector === 2 || sector === 6
                  ? green
                  : white;
          const mouth = tierIndex === 1 && row >= 10 && row < 14 && i % 16 === 5;
          quad(i % 8 === 0 ? concrete : mouth ? dark : color, p, q, r, s);
          quad(
            i % 8 === 0 ? concrete : color,
            p,
            [p[0], row === 0 ? Math.max(0, tier.y - 3) : y - tier.rise, p[2]],
            q,
            [q[0], row === 0 ? Math.max(0, tier.y - 3) : y - tier.rise, q[2]],
          );
        }
      }
    }
    ring(concrete, 69.7, 86.3, 72, 89, 11.38, 0);
    ring(dark, 70.2, 86.8, 72, 89, 14.8, 12);
    ring(dark, 100.8, 111.4, 110.5, 122, 32.98, 0);
    ring(concrete, 100.8, 111.4, 110.5, 122, 32.99);
    // Historic facade: deep recessed galleries behind inclined sky-blue ribs.
    ring(dark, 108.5, 120, 109.5, 121, 29.3, 0);
    for (const [y, h] of [
      [3, 2],
      [10, 2.4],
      [18, 2.3],
      [27, 2.1],
    ])
      ring(concrete, 109.5, 121, 111, 122.5, y!, y! - h!);
    ring(frame, 110.5, 122, 112, 123.5, 30, 28.9);
    // Bowl apron leaves the rectangular pitch completely clear.
    ring(concrete, 50.4, 71.4, 51, 72, 0.15);
    const roof = (a: number, t: number): Point =>
      pt(a, 113 - 44 * t, 124 - 37 * t, 31.8 + 3.3 * t + 1.5 * Math.sin(Math.PI * t));
    for (let i = 0; i < MARACANA_SEGMENTS; i++) {
      const a = (i / MARACANA_SEGMENTS) * Math.PI * 2,
        b = ((i + 1) / MARACANA_SEGMENTS) * Math.PI * 2;
      for (let k = 0; k < 16; k++)
        quad(white, roof(a, k / 16), roof(b, k / 16), roof(a, (k + 1) / 16), roof(b, (k + 1) / 16));
      const p = roof(a, 1),
        q = roof(b, 1);
      quad(white, p, q, [p[0], p[1] - 0.7, p[2]], [q[0], q[1] - 0.7, q[2]]);
    }
    // Blue arches flow from the facade into each corrugated white roof bay.
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      beam(frame, pt(a, 111.3, 122.8, 0), pt(a, 112.5, 123.5, 29.5), 0.8);
      beam(frame, pt(a, 112.5, 123.5, 29.5), roof(a, 0), 0.65);
      for (let k = 0; k < 12; k++) {
        const p = roof(a, k / 12),
          q = roof(a, (k + 1) / 12);
        p[1] += 0.18;
        q[1] += 0.18;
        beam(frame, p, q, 0.36);
      }
      // Slim transverse purlins subdivide the white panels without additional draw calls.
      const b = ((i + 1) / 72) * Math.PI * 2;
      for (let k = 1; k < 8; k++) beam(concrete, roof(a, k / 8), roof(b, k / 8), 0.08);
    }
    // Suspended screens face inward above each goal.
    for (const side of [-1, 1]) {
      box(dark, [0, 29, side * 101], [18, 7, 0.7]);
      // Access bridges are solid volumes descending to the outer concourse.
      for (let j = 0; j < 8; j++) {
        const x = side * (111 + j * 4),
          y = 6 - j * 0.65;
        box(concrete, [x, y, 0], [4.1, 0.65, 12]);
        box(frame, [x, y + 1, 6], [4.1, 0.12, 0.12]);
        box(frame, [x, y + 1, -6], [4.1, 0.12, 0.12]);
      }
    }
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return [concrete, blue, white, yellow, green, frame, dark].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group
      name="Maracanã — cobertura branca e pórticos azuis"
      scale={[1, MARACANA_HEIGHT_SCALE, 1]}
    >
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial
            color={
              ['#b8beb6', '#428dcc', '#eeeFE7', '#e3be3f', '#8faaa0', '#4b9cbe', '#263538'][i]!
            }
            side={2}
            roughness={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}
