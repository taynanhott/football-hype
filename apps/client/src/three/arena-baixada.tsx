import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { BAIXADA_TIERS, baixadaOutline } from './arena-baixada-layout';
type Point = [number, number, number];
export function ArenaBaixada() {
  const meshes = useMemo(() => {
    const seating: number[] = [],
      concrete: number[] = [],
      metal: number[] = [],
      frame: number[] = [],
      dark: number[] = [],
      red: number[] = [];
    const quad = (v: number[], a: Point, b: Point, c: Point, d: Point) =>
      v.push(...a, ...b, ...c, ...b, ...d, ...c);
    const box = (v: number[], p: Point, s: Point) => {
      const pts = Array.from(
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
        quad(v, pts[a!]!, pts[b!]!, pts[c!]!, pts[d!]!);
    };
    const beam = (a: Point, b: Point, width = 0.24) => {
      const d = new Vector3(...b).sub(new Vector3(...a));
      const len = d.length();
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
      const mid = new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5);
      const v: number[] = [];
      box(v, [0, 0, 0], [width, len, width]);
      for (let i = 0; i < v.length; i += 3) {
        const p = new Vector3(v[i]!, v[i + 1]!, v[i + 2]!).applyQuaternion(q).add(mid);
        frame.push(p.x, p.y, p.z);
      }
    };
    const ring = (v: number[], inner: number, outer: number, y: number, base?: number) => {
      const a = baixadaOutline(inner, y),
        b = baixadaOutline(outer, y);
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        quad(v, a[i]!, a[j]!, b[i]!, b[j]!);
        if (base !== undefined) {
          quad(v, a[i]!, [a[i]![0], base, a[i]![2]], a[j]!, [a[j]![0], base, a[j]![2]]);
          quad(v, b[i]!, b[j]!, [b[i]![0], base, b[i]![2]], [b[j]![0], base, b[j]![2]]);
        }
      }
    };
    for (const tier of BAIXADA_TIERS)
      for (let r = 0; r < tier.rows; r++) {
        const d = tier.front + r * 0.72,
          y = tier.y + r * tier.rise;
        const a = baixadaOutline(d, y),
          b = baixadaOutline(d + 0.72, y);
        for (let i = 0; i < a.length; i++) {
          const j = (i + 1) % a.length;
          quad(seating, a[i]!, a[j]!, b[i]!, b[j]!);
          quad(
            concrete,
            a[i]!,
            [a[i]![0], r === 0 ? Math.max(0, tier.y - 3.5) : y - tier.rise, a[i]![2]],
            a[j]!,
            [a[j]![0], r === 0 ? Math.max(0, tier.y - 3.5) : y - tier.rise, a[j]![2]],
          );
          if (i % 13 === 12) {
            const lerp = (a: Point, b: Point, t: number): Point =>
              a.map((n, k) => n + (b[k]! - n) * t + (k === 1 ? 0.025 : 0)) as Point;
            for (const t of [0.18, 0.39, 0.61, 0.82])
              quad(
                concrete,
                lerp(a[i]!, a[j]!, t - 0.008),
                lerp(a[i]!, a[j]!, t + 0.008),
                lerp(b[i]!, b[j]!, t - 0.008),
                lerp(b[i]!, b[j]!, t + 0.008),
              );
          }
        }
      }
    ring(concrete, 11.52, 13, 9.3, 0);
    ring(dark, 12.4, 13, 12.1, 10.1);
    ring(concrete, 25.96, 28, 24.04, 0);
    for (const side of [-1, 1]) {
      // The lower concrete structure and recessed dark facade sit below the silver screen.
      box(dark, [side * 72, 14, 0], [3, 28, 188]);
      box(dark, [0, 14, side * 92], [142, 28, 3]);
      for (let j = 0; j <= 32; j++) {
        const z = -94 + (j * 188) / 32;
        box(concrete, [side * 74, 10, z], [0.8, 20, 0.7]);
        box(frame, [side * 74.3, 27, z], [0.18, 18, 0.18]);
      }
      for (let j = 0; j <= 24; j++) {
        const x = -74 + (j * 148) / 24;
        box(concrete, [x, 10, side * 94], [0.7, 20, 0.8]);
        box(frame, [x, 27, side * 94.3], [0.18, 18, 0.18]);
      }
      for (const y of [4, 10, 16]) {
        box(concrete, [side * 74, y, 0], [0.6, 0.55, 188]);
        box(concrete, [0, y, side * 94], [148, 0.55, 0.6]);
      }
      // Horizontal metallic louvers across the whole upper facade.
      for (let r = 0; r < 26; r++) {
        box(metal, [side * 74.15, 20 + r * 0.57, 0], [0.35, 0.38, 188]);
        box(metal, [0, 20 + r * 0.57, side * 94.15], [148, 0.38, 0.35]);
      }
      // Broad roof wings have shallow barrel-shaped bays rather than flat slabs.
      for (let j = 0; j < 32; j++)
        for (let k = 0; k < 8; k++) {
          const z = -96 + j * 6 + k * 0.75,
            w = z + 0.75;
          const y = 37 + 0.55 * Math.sin((k / 8) * Math.PI),
            v = 37 + 0.55 * Math.sin(((k + 1) / 8) * Math.PI);
          quad(metal, [side * 36, y, z], [side * 76, y, z], [side * 36, v, w], [side * 76, v, w]);
        }
      box(metal, [side * 76, 36.5, 0], [0.5, 1.4, 192]);
      // Fixed underlap keeps the raised parked leaves joined to the surrounding roof.
      box(metal, [0, 36.7, side * 78], [80, 0.6, 36]);
      box(metal, [side * 74.15, 35.5, 0], [0.4, 2.4, 188]);
      box(metal, [0, 35.5, side * 94.15], [148, 2.4, 0.4]);
      // Goal-end leaves are parked above the fixed wings: the retractable roof is open.
      for (let j = 0; j < 6; j++)
        for (let k = 0; k < 8; k++) {
          const z = side * (60 + j * 6 + k * 0.75),
            w = side * (60 + j * 6 + (k + 1) * 0.75);
          const y = 39.4 + 0.55 * Math.sin((k / 8) * Math.PI),
            v = 39.4 + 0.55 * Math.sin(((k + 1) / 8) * Math.PI);
          quad(metal, [-36, y, z], [36, y, z], [-36, v, w], [36, v, w]);
        }
      box(metal, [0, 38.7, side * 60], [72, 1.6, 0.45]);
      box(metal, [0, 38.7, side * 96], [72, 1.6, 0.45]);
      // Exposed deep longitudinal trusses and parallel rails for the moving leaves.
      for (const x of [side * 36, side * 39]) {
        beam([x, 30, -94], [x, 37, -94], 0.32);
        beam([x, 30, -94], [x, 30, 94], 0.36);
        beam([x, 36.6, -94], [x, 36.6, 94], 0.36);
        for (let n = 0; n < 24; n++) {
          const z = -94 + (n * 188) / 24;
          beam([x, 30, z], [x, 36.6, z + 188 / 24], 0.21);
          beam([x, 30, z], [x, 36.6, z], 0.2);
        }
      }
      for (const z of [side * 60, side * 91]) {
        beam([-74, 35, z], [74, 35, z], 0.3);
        beam([-74, 38, z], [74, 38, z], 0.3);
        for (let n = 0; n < 20; n++) beam([-74 + n * 7.4, 35, z], [-66.6 + n * 7.4, 38, z], 0.18);
      }
      for (const x of [-52, 52]) box(red, [x, 23, side * 94.6], [3, 15, 0.18]);
      box(dark, [0, 28, side * 83], [22, 7, 0.5]);
    }
    // Attached circulation block on the main facade.
    box(dark, [0, 7, 98], [42, 14, 7]);
    for (let r = 0; r < 4; r++) box(concrete, [0, 1 + r * 3.5, 102], [42, 0.8, 0.5]);
    const geometry = (v: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      return g;
    };
    return [seating, concrete, metal, frame, dark, red].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group name="Arena da Baixada — cobertura retrátil aberta e fachada metálica">
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={['#777e7b', '#aeb3ae', '#d2d8d4', '#4b5755', '#303b3c', '#9e2932'][i]!}
            side={2}
            metalness={i === 2 ? 0.5 : 0.1}
            roughness={i === 2 ? 0.48 : 0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
