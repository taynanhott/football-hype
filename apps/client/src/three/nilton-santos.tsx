import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import {
  NILTON_MODEL_TIERS as NILTON_TIERS,
  NILTON_PLAN_SCALE,
  NILTON_SEGMENTS,
  niltonPoint as pt,
  niltonLetter,
} from './nilton-santos-layout';
type Point = [number, number, number];
function AccessTowers() {
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={sx + ':' + sz} position={[sx * 108, 0, sz * 88]}>
            <mesh position={[0, 7, 0]}>
              <cylinderGeometry args={[12, 12, 13, 48, 1, true]} />
              <meshStandardMaterial color="#c3c6bb" side={2} />
            </mesh>
            <mesh position={[0, 13.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[6, 12.2, 48]} />
              <meshStandardMaterial color="#b7bcb0" side={2} />
            </mesh>
            <mesh position={[0, 7, 0]}>
              <cylinderGeometry args={[6, 6, 13, 48, 1, true]} />
              <meshStandardMaterial color="#6d7770" side={2} />
            </mesh>
            {Array.from({ length: 48 }, (_, i) => {
              const a = (i / 48) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 12.1, 7, Math.sin(a) * 12.1]}>
                  <boxGeometry args={[0.12, 11, 0.12]} />
                  <meshStandardMaterial color="#747f78" />
                </mesh>
              );
            })}
            {[3, 6, 9, 12].map((y) => (
              <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[6, 11.9, 48]} />
                <meshStandardMaterial color="#a9afa4" side={2} />
              </mesh>
            ))}
          </group>
        )),
      )}
    </group>
  );
}
export function NiltonSantos() {
  const meshes = useMemo(() => {
    const white: number[] = [],
      concrete: number[] = [],
      dark: number[] = [],
      seats: number[] = [],
      black: number[] = [],
      blue: number[] = [],
      glass: number[] = [];
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
      const d = new Vector3(...b).sub(new Vector3(...a)),
        len = d.length(),
        q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()),
        mid = new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5);
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
    ) => {
      for (let i = 0; i < NILTON_SEGMENTS; i++) {
        const a = (i / NILTON_SEGMENTS) * Math.PI * 2,
          b = ((i + 1) / NILTON_SEGMENTS) * Math.PI * 2,
          p = pt(a, ix, iz, y),
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
    for (const [tierIndex, tier] of NILTON_TIERS.entries())
      for (let row = 0; row < tier.rows; row++)
        for (let i = 0; i < NILTON_SEGMENTS; i++) {
          const a = (i / NILTON_SEGMENTS) * Math.PI * 2,
            b = ((i + 1) / NILTON_SEGMENTS) * Math.PI * 2,
            y = tier.y + row * tier.rise;
          const p = pt(a, tier.x + row * tier.stepX, tier.z + row * tier.stepZ, y),
            q = pt(b, tier.x + row * tier.stepX, tier.z + row * tier.stepZ, y),
            r = pt(a, tier.x + (row + 1) * tier.stepX, tier.z + (row + 1) * tier.stepZ, y),
            s = pt(b, tier.x + (row + 1) * tier.stepX, tier.z + (row + 1) * tier.stepZ, y);
          const portal = tierIndex === 1 && row >= 6 && row < 10 && i % 32 === 10,
            color =
              tierIndex === 1 && niltonLetter((a + b) / 2, row)
                ? black
                : (i * 17 + row * 31) % 7 === 0
                  ? black
                  : seats;
          quad(i % 16 === 0 ? concrete : portal ? dark : color, p, q, r, s);
          quad(
            i % 16 === 0 ? concrete : color,
            p,
            [p[0], row === 0 ? Math.max(0, tier.y - 3.7) : y - tier.rise, p[2]],
            q,
            [q[0], row === 0 ? Math.max(0, tier.y - 3.7) : y - tier.rise, q[2]],
          );
        }
    band(concrete, 74.2, 97.6, 77, 102, 8.3, 0);
    band(dark, 75, 99, 77, 102, 11.9, 9);
    band(concrete, 96.5, 117.6, 105, 135, 24.5);
    band(dark, 98, 120, 105, 135, 28, 0);
    for (const [y, h] of [
      [3, 2],
      [9, 2],
      [16, 2],
      [24, 2],
    ])
      band(concrete, 104.8, 134.8, 107, 137, y!, y! - h!);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      beam(concrete, pt(a, 106.8, 136.8, 0), pt(a, 106.8, 136.8, 29), 0.75);
    }
    const roof = (a: number, t: number) =>
      pt(a, 70 + 39 * t, 102 + 38 * t, 30.7 - 1.7 * t + 0.6 * Math.sin(Math.PI * t));
    for (let i = 0; i < NILTON_SEGMENTS; i++) {
      const a = (i / NILTON_SEGMENTS) * Math.PI * 2,
        b = ((i + 1) / NILTON_SEGMENTS) * Math.PI * 2;
      for (let k = 0; k < 12; k++)
        quad(white, roof(a, k / 12), roof(b, k / 12), roof(a, (k + 1) / 12), roof(b, (k + 1) / 12));
    }
    // Four independent, gently curved arch planes, each suspended from paired corner pylons.
    for (const side of [-1, 1])
      for (const transverse of [false, true]) {
        const point = (t: number, raised: boolean): Point =>
          transverse
            ? [
                -85 + 170 * t,
                29 + (raised ? 17 * Math.sin(Math.PI * t) : 0),
                side * (109 + 10 * Math.sin(Math.PI * t)),
              ]
            : [
                side * (85 + 10 * Math.sin(Math.PI * t)),
                29 + (raised ? 21 * Math.sin(Math.PI * t) : 0),
                -109 + 218 * t,
              ];
        for (let j = 0; j < 48; j++)
          beam(white, point(j / 48, true), point((j + 1) / 48, true), 1.15);
        beam(white, point(0, false), point(1, false), 0.38);
        for (let j = 1; j < 16; j++) {
          const t = j / 16,
            p = point(t, true),
            b = point(t, false);
          beam(white, p, b, 0.24);
          beam(white, p, point((j + 1) / 16, false), 0.19);
        }
      }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (const d of [-1, 1]) {
          const x = sx * (85 + d * 1.8),
            z = sz * (109 - d * 1.8);
          // Faceted cylindrical pylons, batched with the remaining concrete structure.
          for (let j = 0; j < 20; j++) {
            const a = (j / 20) * Math.PI * 2,
              b = ((j + 1) / 20) * Math.PI * 2;
            quad(
              concrete,
              [x + 1.55 * Math.cos(a), 0, z + 1.55 * Math.sin(a)],
              [x + 1.55 * Math.cos(b), 0, z + 1.55 * Math.sin(b)],
              [x + 1.55 * Math.cos(a), 30, z + 1.55 * Math.sin(a)],
              [x + 1.55 * Math.cos(b), 30, z + 1.55 * Math.sin(b)],
            );
          }
        }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) box(concrete, [sx * 101, 8, sz * 88], [18, 0.65, 8]);
    // Blue athletics track around the pitch, with a smooth inner rectangular clearance.
    const track = (a: number, x: number, z: number, y: number): Point => [
      x * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.45,
      y,
      z * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.45,
    ];
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * Math.PI * 2,
        b = ((i + 1) / 256) * Math.PI * 2;
      quad(
        blue,
        track(a, 40 / NILTON_PLAN_SCALE, 61 / NILTON_PLAN_SCALE, 0.12),
        track(b, 40 / NILTON_PLAN_SCALE, 61 / NILTON_PLAN_SCALE, 0.12),
        track(a, 48, 72, 0.12),
        track(b, 48, 72, 0.12),
      );
      quad(
        blue,
        track(a, 48, 72, 0.11),
        track(b, 48, 72, 0.11),
        pt(a, 58, 85, 0.11),
        pt(b, 58, 85, 0.11),
      );
      for (let lane = 0; lane <= 7; lane++)
        quad(
          white,
          track(
            a,
            40 / NILTON_PLAN_SCALE + lane * 0.55,
            61 / NILTON_PLAN_SCALE + lane * 0.55,
            0.135,
          ),
          track(b, 40 + lane, 61 + lane, 0.135),
          track(
            a,
            40 / NILTON_PLAN_SCALE + lane * 0.55 + 0.045,
            61 / NILTON_PLAN_SCALE + lane * 0.55 + 0.045,
            0.135,
          ),
          track(b, 40.045 + lane, 61.045 + lane, 0.135),
        );
    }
    const star: Point[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 1.6 : 3.8;
      star.push([Math.cos(a) * r, 0.16, 77 + Math.sin(a) * r]);
    }
    for (let i = 0; i < 10; i++) white.push(0, 0.16, 77, ...star[i]!, ...star[(i + 1) % 10]!);
    for (const side of [-1, 1]) {
      box(dark, [0, 24, side * 112], [19, 6.5, 0.7]);
      box(concrete, [side * 109, 8, 0], [14, 16, 26]);
      box(glass, [side * 116.1, 9, 0], [0.15, 12, 22]);
    }
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2,
        b = ((i + 1) / 64) * Math.PI * 2;
      beam(white, roof(a, 0), roof(b, 0), 0.16);
      beam(white, roof(a, 0), roof(a, 1), 0.12);
    }
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return [white, concrete, dark, seats, black, blue, glass].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group
      name="Nilton Santos — quatro arcos e pista azul"
      scale={[NILTON_PLAN_SCALE, 1, NILTON_PLAN_SCALE]}
    >
      <AccessTowers />
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={
              ['#edeee5', '#b9bdb1', '#2f3a3b', '#b8c3bd', '#303a3b', '#2e8dc3', '#6c8f91'][i]!
            }
            side={2}
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}
