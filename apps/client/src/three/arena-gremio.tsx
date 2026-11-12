import { pushStandQuad } from './stand-aisle';
import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { GREMIO_TIERS, GREMIO_SEGMENTS, gremioPoint as pt } from './arena-gremio-layout';
type Point = [number, number, number];
function ArenaName() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e4e9e4';
    ctx.fillRect(0, 0, 1536, 256);
    ctx.fillStyle = '#286387';
    ctx.fillRect(12, 12, 1512, 232);
    ctx.fillStyle = '#edf3ef';
    ctx.textAlign = 'center';
    ctx.font = 'bold 112px Arial';
    ctx.fillText('ARENA DO GRÊMIO', 768, 168);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 19, 120.35]}>
      <planeGeometry args={[48, 8]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}
export function ArenaGremio() {
  const meshes = useMemo(() => {
    const seats: number[] = [],
      concrete: number[] = [],
      white: number[] = [],
      glass: number[] = [],
      navy: number[] = [],
      steel: number[] = [],
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
    const beam = (v: number[], a: Point, b: Point, w: number) => {
      const delta = new Vector3(...b).sub(new Vector3(...a)),
        len = delta.length();
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
      const mid = new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5);
      const raw: number[] = [];
      box(raw, [0, 0, 0], [w, len, w]);
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
      exponent = 0.45,
    ) => {
      for (let i = 0; i < GREMIO_SEGMENTS; i++) {
        const a = (i / GREMIO_SEGMENTS) * Math.PI * 2,
          b = ((i + 1) / GREMIO_SEGMENTS) * Math.PI * 2;
        const p = pt(a, ix, iz, y, exponent),
          q = pt(b, ix, iz, y, exponent),
          r = pt(a, ox, oz, y, exponent),
          s = pt(b, ox, oz, y, exponent);
        quad(v, p, q, r, s);
        if (base !== undefined) {
          quad(v, p, [p[0], base, p[2]], q, [q[0], base, q[2]]);
          quad(v, r, s, [r[0], base, r[2]], [s[0], base, s[2]]);
        }
      }
    };
    for (const [tierIndex, tier] of GREMIO_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const d = tier.front + row * tier.step,
          y = tier.y + row * tier.rise;
        for (let i = 0; i < GREMIO_SEGMENTS; i++) {
          const a = (i / GREMIO_SEGMENTS) * Math.PI * 2,
            b = ((i + 1) / GREMIO_SEGMENTS) * Math.PI * 2;
          const p = pt(a, 40 + d, 59 + d, y),
            q = pt(b, 40 + d, 59 + d, y),
            r = pt(a, 40 + d + tier.step, 59 + d + tier.step, y),
            s = pt(b, 40 + d + tier.step, 59 + d + tier.step, y);
          const entrance = tierIndex === 2 && row >= 9 && row < 13 && i % 16 === 5;
          pushStandQuad(entrance ? dark : seats, concrete, p, q, r, s, i % 8 === 0);
          pushStandQuad(
            seats,
            concrete,
            p,
            q,
            [p[0], row === 0 ? tier.y - 3 : y - tier.rise, p[2]],
            [q[0], row === 0 ? tier.y - 3 : y - tier.rise, q[2]],
            i % 8 === 0,
          );
        }
      }
    // Narrow hospitality ring and its recessed glazing sit between the lower and upper decks.
    band(concrete, 52.96, 71.96, 53.8, 72.8, 11.32, 0);
    band(navy, 53, 72, 53.8, 72.8, 14.8, 12);
    band(concrete, 56.52, 75.52, 58, 77, 16.5, 0);
    band(dark, 57, 76, 58, 77, 19.9, 17);
    for (let i = 0; i < GREMIO_SEGMENTS; i++) {
      const a = (i / GREMIO_SEGMENTS) * Math.PI * 2,
        b = ((i + 1) / GREMIO_SEGMENTS) * Math.PI * 2;
      quad(
        concrete,
        pt(a, 80.36, 99.36, 34.25),
        pt(b, 80.36, 99.36, 34.25),
        pt(a, 93, 118, 34.25, 0.62),
        pt(b, 93, 118, 34.25, 0.62),
      );
    }
    band(dark, 81, 100, 93, 118, 34.2, 3.5, 0.62);
    // The broad elevated esplanade surrounds a rounded rectangular deep-blue facade.
    band(concrete, 94, 119, 112, 137, 4, 0, 0.62);
    band(navy, 93.8, 118.8, 95, 120, 30, 7.5, 0.62);
    band(white, 94.9, 119.9, 95.5, 120.5, 8.5, 7.4, 0.62);
    band(white, 94.9, 119.9, 95.5, 120.5, 30.2, 29.2, 0.62);
    band(white, 111.7, 136.7, 112.3, 137.3, 4.7, 4, 0.62);
    const roof = (a: number, t: number): Point => {
      const inner = pt(a, 42, 62, 43),
        outer = pt(a, 97, 122, 38, 0.62);
      return [
        inner[0] + (outer[0] - inner[0]) * t,
        43 - 5 * t + 1.3 * Math.sin(Math.PI * t),
        inner[2] + (outer[2] - inner[2]) * t,
      ];
    };
    for (let i = 0; i < GREMIO_SEGMENTS; i++) {
      const a = (i / GREMIO_SEGMENTS) * Math.PI * 2,
        b = ((i + 1) / GREMIO_SEGMENTS) * Math.PI * 2;
      for (let k = 0; k < 20; k++)
        quad(
          k < 3 ? glass : white,
          roof(a, k / 20),
          roof(b, k / 20),
          roof(a, (k + 1) / 20),
          roof(b, (k + 1) / 20),
        );
      const p = roof(a, 0),
        q = roof(b, 0),
        r = roof(a, 1),
        s = roof(b, 1);
      quad(white, p, q, [p[0], p[1] - 0.6, p[2]], [q[0], q[1] - 0.6, q[2]]);
      quad(white, r, s, [r[0], r[1] - 0.55, r[2]], [s[0], s[1] - 0.55, s[2]]);
      // Fine dark-blue fins across the curved facade, kept in a single geometry batch.
      beam(
        i % 3 === 0 ? glass : navy,
        pt(a, 95.15, 120.15, 8.7, 0.62),
        pt(a, 95.15, 120.15, 29, 0.62),
        0.18,
      );
    }
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2,
        b = ((i + 1) / 64) * Math.PI * 2;
      const base = pt(a, 93, 118, 30, 0.62),
        top = roof(a, 0.94);
      top[1] -= 0.5;
      beam(steel, base, top, 0.38);
      const next = roof(b, 0.94);
      next[1] -= 0.5;
      beam(steel, base, next, 0.24);
      const end = roof(a, 0);
      end[1] -= 1;
      beam(steel, top, end, 0.22);
      for (let k = 1; k < 20; k++) {
        const p = roof(a, k / 20),
          q = roof(b, k / 20);
        p[1] += 0.025;
        q[1] += 0.025;
        beam(white, p, q, 0.055);
      }
      // Light poles and railings on the esplanade.
      const p = pt(a, 108, 133, 4, 0.62);
      beam(steel, p, [p[0], 8, p[2]], 0.1);
    }
    // Solid gently descending entrance ramp, attached to the elevated perimeter.
    for (let j = 0; j < 16; j++) {
      const z = 137 + j * 3,
        y = 4 - j * 0.2;
      box(concrete, [0, y, z], [14, 0.65, 3.1]);
      box(white, [-7, y + 0.9, z], [0.15, 1.1, 3.1]);
      box(white, [7, y + 0.9, z], [0.15, 1.1, 3.1]);
    }
    for (const side of [-1, 1]) box(dark, [0, 34, side * 92], [20, 7, 0.6]);
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return [seats, concrete, white, glass, navy, steel, dark].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group name="Arena do Grêmio — cobertura branca e fachada azul">
      <ArenaName />
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={
              ['#338caf', '#b7b8ac', '#f0f1e9', '#6e9aa4', '#122f59', '#bac4c1', '#26363d'][i]!
            }
            side={2}
            roughness={i === 3 ? 0.4 : 0.8}
            metalness={i === 3 ? 0.25 : 0.05}
          />
        </mesh>
      ))}
    </group>
  );
}
