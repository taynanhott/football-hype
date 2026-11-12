import { useEffect, useMemo } from 'react';
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, SRGBColorSpace } from 'three';
import {
  MORUMBI_MODEL_TIERS as MORUMBI_TIERS,
  MORUMBI_HEIGHT_SCALE,
  morumbiPoint,
} from './morumbi-layout';
type Point = [number, number, number];
function Box({ p, size, color = '#b9b7a9' }: { p: Point; size: Point; color?: string }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
function Bowl() {
  const meshes = useMemo(() => {
    const concrete: number[] = [],
      red: number[] = [],
      dark: number[] = [],
      track: number[] = [],
      white: number[] = [];
    const quad = (v: number[], a: Point, b: Point, c: Point, d: Point) =>
      v.push(...a, ...b, ...c, ...b, ...d, ...c);
    const band = (
      v: number[],
      ix: number,
      iz: number,
      ox: number,
      oz: number,
      y: number,
      bottom?: number,
    ) => {
      for (let i = 0; i < 192; i++) {
        const a = (i / 192) * Math.PI * 2,
          b = ((i + 1) / 192) * Math.PI * 2;
        const p = morumbiPoint(a, ix, iz, y),
          q = morumbiPoint(b, ix, iz, y),
          r = morumbiPoint(a, ox, oz, y),
          s = morumbiPoint(b, ox, oz, y);
        quad(v, p, q, r, s);
        if (bottom !== undefined) {
          quad(v, p, [p[0], bottom, p[2]], q, [q[0], bottom, q[2]]);
          quad(v, r, s, [r[0], bottom, r[2]], [s[0], bottom, s[2]]);
        }
      }
    };
    for (const tier of MORUMBI_TIERS) {
      for (let row = 0; row < tier.rows; row++) {
        const d = row * tier.step,
          y = tier.y + row * tier.rise;
        for (let i = 0; i < 192; i++) {
          const a = (i / 192) * Math.PI * 2,
            b = ((i + 1) / 192) * Math.PI * 2;
          const p = morumbiPoint(a, tier.x + d, tier.z + d, y),
            q = morumbiPoint(b, tier.x + d, tier.z + d, y);
          const r = morumbiPoint(a, tier.x + d + tier.step, tier.z + d + tier.step, y),
            s = morumbiPoint(b, tier.x + d + tier.step, tier.z + d + tier.step, y);
          // Continuous treads, closed risers and regularly spaced concrete stair aisles.
          quad(i % 12 === 0 ? concrete : red, p, q, r, s);
          quad(
            i % 12 === 0 ? concrete : red,
            p,
            [p[0], row === 0 ? Math.max(0, tier.y - 2.94) : y - tier.rise, p[2]],
            q,
            [q[0], row === 0 ? Math.max(0, tier.y - 2.94) : y - tier.rise, q[2]],
          );
        }
      }
    }
    // Solid concourse terraces bridge the lower rings; upper fascia conceals their supports.
    band(concrete, 69.2, 89.2, 71, 91, 6.26, 0);
    band(concrete, 78.2, 98.2, 80, 100, 14.26, 0);
    band(dark, 101.8, 121.8, 103, 123, 38, 0);
    band(concrete, 102.8, 122.8, 104, 124, 39.1, 38.3);
    for (const [y, h] of [
      [2, 2],
      [11, 7],
      [23, 6],
      [39.1, 1.3],
    ])
      band(concrete, 102.9, 122.9, 104, 124, y!, y! - h!);
    // Track uses a rounded rectangle, so its straight lanes follow the touchlines.
    const trackPoint = (a: number, x: number, z: number, y: number): Point => [
      x * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.32,
      y,
      z * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.32,
    ];
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * Math.PI * 2,
        b = ((i + 1) / 256) * Math.PI * 2;
      quad(
        track,
        trackPoint(a, 41, 61, 0.08),
        trackPoint(b, 41, 61, 0.08),
        trackPoint(a, 45, 65, 0.08),
        trackPoint(b, 45, 65, 0.08),
      );
      for (let lane = 0; lane <= 4; lane++)
        quad(
          white,
          trackPoint(a, 41 + lane, 61 + lane, 0.09),
          trackPoint(b, 41 + lane, 61 + lane, 0.09),
          trackPoint(a, 41.06 + lane, 61.06 + lane, 0.09),
          trackPoint(b, 41.06 + lane, 61.06 + lane, 0.09),
        );
      const inner = (t: number) => trackPoint(t, 45.1, 65.1, 0.07);
      const outer = (t: number) => morumbiPoint(t, 61.8, 81.8, 0.07);
      const wave = (t: number, f: number): Point => {
        const p = inner(t),
          q = outer(t);
        return p.map((v, k) => v + (q[k]! - v) * f) as Point;
      };
      const f = 0.42 + Math.sin(a * 6) * 0.17,
        g = 0.42 + Math.sin(b * 6) * 0.17;
      quad(red, inner(a), inner(b), wave(a, f), wave(b, g));
      quad(white, wave(a, f), wave(b, g), wave(a, f + 0.18), wave(b, g + 0.18));
      quad(dark, wave(a, f + 0.18), wave(b, g + 0.18), outer(a), outer(b));
    }
    const geometry = (v: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      return g;
    };
    return [concrete, red, dark, track, white].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group>
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} receiveShadow castShadow={i < 3}>
          <meshStandardMaterial
            color={['#b8b8ad', '#b8393d', '#262c2d', '#a95048', '#ecebe1'][i]!}
            side={2}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
function FacadeName() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7252e';
    ctx.font = 'bold 65px Arial';
    ctx.fillText('SÃO PAULO FUTEBOL CLUBE', 512, 83);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 36.6, 123.5]}>
      <planeGeometry args={[51, 6.4]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
function LightingBridge({ side }: { side: number }) {
  return (
    <group>
      {[-38, 38].map((x) => (
        <Box key={x} p={[x, 25, side * 119]} size={[1.5, 50, 1.8]} />
      ))}
      {[48, 51].map((y) => (
        <Box key={y} p={[0, y, side * 115]} size={[102, 0.35, 0.35]} color="#a8b0ad" />
      ))}
      {[-117, -113].map((z) => (
        <Box key={z} p={[0, 51, side * Math.abs(z)]} size={[102, 0.3, 0.3]} color="#acb4b0" />
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <group key={i}>
          <mesh position={[-50 + i * 4, 49.5, side * 115]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.16, 4.2, 0.16]} />
            <meshStandardMaterial color="#a7b0ac" />
          </mesh>
          <Box p={[-50 + i * 4, 48.4, side * 113]} size={[2.5, 1.1, 0.8]} color="#e0e5da" />
        </group>
      ))}
    </group>
  );
}
export function Morumbi() {
  return (
    <group name="Morumbi — anel superior e pista tricolor" scale={[1, MORUMBI_HEIGHT_SCALE, 1]}>
      <Bowl />
      <FacadeName />
      {[-1, 1].map((side) => (
        <group key={side}>
          <LightingBridge side={side} />
          <Box p={[0, 40.8, side * 119]} size={[24, 11, 1]} color="#b6b9b0" />
          <Box p={[0, 40.8, side * 118.4]} size={[22.8, 9.8, 0.2]} color="#142126" />
        </group>
      ))}
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2,
          p = morumbiPoint(a, 104.3, 124.3, 19);
        return (
          <mesh key={i} position={p} rotation={[0, -a, 0]}>
            <boxGeometry args={[1, 38, 1]} />
            <meshStandardMaterial color="#b4b4a7" />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[side * 72, 9.1, 0]} size={[8, 0.6, 32]} color="#b4a99d" />
          <Box p={[side * 71, 6, 0]} size={[6, 0.5, 24]} color="#d9d8cb" />
        </group>
      ))}
    </group>
  );
}
