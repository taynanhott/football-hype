import { pushStandQuad } from './stand-aisle';
import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { MRV_TIERS, MRV_SEGMENTS, mrvPoint as pt } from './arena-mrv-layout';
type Point = [number, number, number];
function Branding() {
  const textures = useMemo(() => {
    const name = document.createElement('canvas');
    name.width = 1024;
    name.height = 160;
    const n = name.getContext('2d')!;
    n.fillStyle = '#172123';
    n.textAlign = 'center';
    n.font = 'bold 110px Arial';
    n.fillText('ARENA MRV', 512, 121);
    const shield = document.createElement('canvas');
    shield.width = 384;
    shield.height = 512;
    const c = shield.getContext('2d')!;
    c.fillStyle = '#d0af49';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 17 : 39;
      const x = 192 + Math.cos(a) * r,
        y = 50 + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(56, 128);
    c.quadraticCurveTo(192, 155, 328, 128);
    c.lineTo(316, 310);
    c.quadraticCurveTo(286, 398, 192, 464);
    c.quadraticCurveTo(98, 398, 68, 310);
    c.closePath();
    c.fillStyle = '#151d20';
    c.fill();
    c.strokeStyle = '#e3e8e2';
    c.lineWidth = 8;
    c.stroke();
    c.font = 'bold 66px Arial';
    c.textAlign = 'center';
    c.fillStyle = '#e3e8e2';
    c.fillText('CAM', 192, 238);
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(72, 256);
    c.lineTo(312, 256);
    for (const x of [115, 154, 192, 230, 269]) {
      c.moveTo(x, 260);
      c.lineTo(x, 360 - Math.abs(x - 192) * 0.45 + 50);
    }
    c.stroke();
    return [name, shield].map((canvas) => {
      const t = new CanvasTexture(canvas);
      t.colorSpace = SRGBColorSpace;
      return t;
    });
  }, []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 23, side * 100.45]}
          rotation={[0, side === 1 ? 0 : Math.PI, 0]}
        >
          <planeGeometry args={[32, 5]} />
          <meshStandardMaterial map={textures[0]!} transparent depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[68.8, 21, 86.1]} rotation={[0, Math.PI / 4, 0]}>
        <planeGeometry args={[9, 12]} />
        <meshStandardMaterial map={textures[1]!} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
export function ArenaMrv() {
  const meshes = useMemo(() => {
    const white: number[] = [],
      silver: number[] = [],
      dark: number[] = [],
      concrete: number[] = [],
      steel: number[] = [],
      seats: number[] = [],
      lightSeats: number[] = [];
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
      for (let i = 0; i < MRV_SEGMENTS; i++) {
        const a = (i / MRV_SEGMENTS) * Math.PI * 2,
          b = ((i + 1) / MRV_SEGMENTS) * Math.PI * 2,
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
    for (const [tierIndex, tier] of MRV_TIERS.entries())
      for (let row = 0; row < tier.rows; row++) {
        const y = tier.y + row * tier.rise,
          d = tier.front + row * tier.step;
        for (let i = 0; i < MRV_SEGMENTS; i++) {
          const a = (i / MRV_SEGMENTS) * Math.PI * 2,
            b = ((i + 1) / MRV_SEGMENTS) * Math.PI * 2,
            p = pt(a, 41 + d, 61 + d, y),
            q = pt(b, 41 + d, 61 + d, y),
            r = pt(a, 41 + d + tier.step, 61 + d + tier.step, y),
            s = pt(b, 41 + d + tier.step, 61 + d + tier.step, y);
          const hash = (Math.imul(i + 1, 73856093) ^ Math.imul(row + 1, 19349663)) >>> 0;
          const color = hash % 3 === 0 ? lightSeats : seats,
            portal = tierIndex === 2 && row >= 6 && row < 10 && i % 16 === 5;
          pushStandQuad(portal ? dark : color, concrete, p, q, r, s, i % 8 === 0);
          pushStandQuad(
            color,
            concrete,
            p,
            q,
            [p[0], row === 0 ? tier.y - 3 : y - tier.rise, p[2]],
            [q[0], row === 0 ? tier.y - 3 : y - tier.rise, q[2]],
            i % 8 === 0,
          );
        }
      }
    band(concrete, 52.2, 72.2, 53.2, 73.2, 10.7, 4);
    band(dark, 52.5, 72.5, 53.2, 73.2, 11.9, 10.8);
    band(concrete, 55.3, 75.3, 56, 76, 12.86, 4);
    band(dark, 55.5, 75.5, 56, 76, 15.4, 13);
    band(concrete, 75.68, 95.68, 78.7, 98.7, 27);
    band(dark, 76, 96, 79, 99, 28, 4);
    // Arc-length sampling keeps the facade stripes equally wide around the rounded corners.
    const outline = new CatmullRomCurve3(
      Array.from(
        { length: 128 },
        (_, i) => new Vector3(...pt((i / 128) * Math.PI * 2, 80, 100, 0)),
      ),
      true,
    );
    const shell = (u: number, t: number): Point => {
      const p = outline.getPointAt(((u % 1) + 1) % 1);
      let inset = 0,
        y = 4;
      if (t <= 0.5) y = 4 + (t / 0.5) * 23;
      else if (t <= 0.75) {
        const a = (((t - 0.5) / 0.25) * Math.PI) / 2;
        inset = 11 * (1 - Math.cos(a));
        y = 27 + 11 * Math.sin(a);
      } else {
        inset = 11 + ((t - 0.75) / 0.25) * 27;
        y = 38;
      }
      return [p.x * (1 - inset / 80), y, p.z * (1 - inset / 100)];
    };
    for (let stripe = 0; stripe < 48; stripe++) {
      const v = stripe % 2 === 0 ? white : silver;
      for (let j = 0; j < 48; j++)
        for (let k = 0; k < 6; k++) {
          const u = (stripe + k / 6) / 48,
            w = (stripe + (k + 1) / 6) / 48,
            t = j / 48,
            next = (j + 1) / 48;
          // Grey ribbons stop above the entrance glazing; white ribbons reach the podium.
          if (stripe % 2 === 1 && j < 10) continue;
          quad(v, shell(u, t), shell(w, t), shell(u, next), shell(w, next));
        }
      const mid = (stripe + 0.5) / 48,
        p = shell(mid, 0.21),
        a = shell(stripe / 48, 0.1),
        b = shell((stripe + 1) / 48, 0.21);
      beam(steel, a, b, 0.2);
      beam(steel, [a[0], p[1], a[2]], shell((stripe + 1) / 48, 0.1), 0.2);
    }
    band(silver, 42, 62, 47, 67, 38.04);
    // Exposed trusses follow the rectangular opening and remain entirely below the skin.
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2,
        b = ((i + 1) / 64) * Math.PI * 2;
      beam(steel, pt(a, 42, 62, 35.8), pt(b, 42, 62, 37.6), 0.15);
      beam(steel, pt(a, 42, 62, 35.8), pt(b, 42, 62, 35.8), 0.22);
      beam(steel, pt(a, 42, 62, 37.6), pt(b, 42, 62, 37.6), 0.22);
    }
    // Podium on slender columns, with a recessed service level and access stairs.
    band(concrete, 79, 99, 91, 111, 4, 3.4);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2,
        p = pt(a, 90, 110, 1.7);
      box(concrete, p, [0.55, 3.4, 0.55]);
    }
    for (let j = 0; j < 12; j++) {
      const z = 111 + j * 1.2,
        y = 4 - j * 0.31;
      box(concrete, [0, y, z], [16, 0.5, 1.3]);
    }
    for (const side of [-1, 1]) box(dark, [0, 30, side * 88], [19, 6, 0.7]);
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return [white, silver, dark, concrete, steel, seats, lightSeats].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group name="Arena MRV — faixas contínuas e cobertura arredondada">
      <Branding />
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={
              ['#edeee8', '#81898b', '#253035', '#b8b9ae', '#8f9c99', '#596766', '#afb7b1'][i]!
            }
            side={2}
            roughness={i < 2 ? 0.52 : 0.85}
            metalness={i < 2 ? 0.35 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}
