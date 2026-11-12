import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';

type Point = [number, number, number];
function Box({ p, size, color = '#e9ece8' }: { p: Point; size: Point; color?: string }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}
function Strut({ a, b, width = 0.22 }: { a: Point; b: Point; width?: number }) {
  const mid = a.map((v, i) => (v + b[i]!) / 2) as Point;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const orientation = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(),
  );
  return (
    <group position={mid} quaternion={orientation}>
      <mesh>
        <boxGeometry args={[width, length, width]} />
        <meshStandardMaterial color="#c5ceca" />
      </mesh>
    </group>
  );
}

function Roof() {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const height = (x: number, z: number) =>
      31.8 + 1.5 * (1 - (z / 91) ** 2) + 1.1 * (1 - (x / 83) ** 2);
    const quad = (a: Point, b: Point, c: Point, d: Point) =>
      vertices.push(...a, ...b, ...c, ...b, ...d, ...c);
    // Four continuous shallow cambered wings, open only over the playing area.
    for (const side of [-1, 1]) {
      for (let j = 0; j < 48; j++)
        for (let k = 0; k < 12; k++) {
          const z = -91 + (j * 182) / 48,
            w = z + 182 / 48;
          const x = side * (36 + (k * 47) / 12),
            v = side * (36 + ((k + 1) * 47) / 12);
          quad(
            [x, height(x, z), z],
            [v, height(v, z), z],
            [x, height(x, w), w],
            [v, height(v, w), w],
          );
        }
      for (let j = 0; j < 24; j++)
        for (let k = 0; k < 8; k++) {
          const x = -36 + j * 3,
            v = x + 3,
            z = side * (58 + (k * 33) / 8),
            w = side * (58 + ((k + 1) * 33) / 8);
          quad(
            [x, height(x, z), z],
            [v, height(v, z), z],
            [x, height(x, w), w],
            [v, height(v, w), w],
          );
        }
      // Deep but slender fascia at the outer edge and around the rectangular opening.
      for (const [x1, z1, x2, z2] of [
        [side * 83, -91, side * 83, 91],
        [-83, side * 91, 83, side * 91],
        [side * 36, -58, side * 36, 58],
        [-36, side * 58, 36, side * 58],
      ]) {
        const a: Point = [x1!, height(x1!, z1!), z1!],
          b: Point = [x2!, height(x2!, z2!), z2!];
        quad(a, b, [a[0], a[1] - 1.15, a[2]], [b[0], b[1] - 1.15, b[2]]);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#f1f1e9" roughness={0.63} side={2} />
    </mesh>
  );
}

function EndWall({ side, sx }: { side: number; sx: number }) {
  const geometry = useMemo(() => {
    // Faceted white cheeks stop short of the low goal stands, preserving open ends.
    const outline = [
      [61, 0],
      [80, 0],
      [80, 28.7],
      [61, 28.7],
      [47, 15],
    ];
    const v: number[] = [];
    const front = outline.map(([x, y]) => [sx * x!, y!, side * 76] as Point);
    const back = outline.map(([x, y]) => [sx * x!, y!, side * 72] as Point);
    for (let i = 1; i < outline.length - 1; i++)
      v.push(
        ...front[0]!,
        ...front[i]!,
        ...front[i + 1]!,
        ...back[0]!,
        ...back[i + 1]!,
        ...back[i]!,
      );
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      v.push(...front[i]!, ...back[i]!, ...front[j]!, ...front[j]!, ...back[i]!, ...back[j]!);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [side, sx]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#e9ece7" side={2} />
    </mesh>
  );
}

function CornerInfill({ sx, sz }: { sx: number; sz: number }) {
  const geometry = useMemo(() => {
    // Closed concrete transition between the lateral stand, goal stand and external cheek.
    const top: Point[] = [
      [39.5, 1.35, 57],
      [61, 21, 57],
      [61, 13.35, 77.8],
      [39.5, 13.35, 77.8],
    ].map(([x, y, z]) => [sx * x!, y!, sz * z!] as Point);
    const vertices: number[] = [];
    const quad = (a: Point, b: Point, c: Point, d: Point) =>
      vertices.push(...a, ...b, ...c, ...b, ...d, ...c);
    quad(top[0]!, top[1]!, top[3]!, top[2]!);
    for (let i = 0; i < 4; i++) {
      const a = top[i]!,
        b = top[(i + 1) % 4]!;
      quad(a, b, [a[0], 0, a[2]], [b[0], 0, b[2]]);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, [sx, sz]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#d9dfd9" side={2} />
    </mesh>
  );
}

function RoofNames() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#242d2e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 132px Arial';
    ctx.fillText('neo', 512, 140);
    ctx.fillText('química', 512, 280);
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#242d2e';
    ctx.beginPath();
    ctx.moveTo(190, 320);
    ctx.lineTo(820, 320);
    ctx.lineTo(820, 430);
    ctx.stroke();
    ctx.font = '94px Arial';
    ctx.fillText('arena', 505, 420);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 61, 34.15, 0]}
          rotation={[-Math.PI / 2, 0, (side * Math.PI) / 2]}
        >
          <planeGeometry args={[43, 21.5]} />
          <meshStandardMaterial
            map={texture}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </group>
  );
}

export function NeoQuimicaArena() {
  return (
    <group name="Neo Química Arena — cobertura contínua e cabeceiras abertas">
      <Roof />
      <RoofNames />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            p={[side * 70, 14, 0]}
            size={[18, 28, 145]}
            color={side === 1 ? '#dbe6e2' : '#eeeee7'}
          />
          {/* The huge east glass screen is pale and nearly flush with the white cladding. */}
          <Box
            p={[side * 79.15, 14.7, 0]}
            size={[0.25, 22.8, 130]}
            color={side === 1 ? '#bed4d2' : '#e4e6df'}
          />
          {Array.from({ length: 27 }, (_, i) => (
            <Box
              key={i}
              p={[side * 79.33, 14.7, -65 + i * 5]}
              size={[0.12, 22.8, 0.1]}
              color="#dfe6df"
            />
          ))}
          <Box p={[side * 79.35, 3.1, 0]} size={[0.2, 2, 138]} color="#959f98" />
          <Box p={[side * 82, 2.5, 0]} size={[6, 0.6, 20]} />
          {Array.from({ length: 32 }, (_, r) => (
            <group key={r}>
              <Box
                p={[side * (40 + r * 0.75), (1.4 + r * 0.7) / 2, 0]}
                size={[0.82, 1.4 + r * 0.7, 114]}
                color={r % 8 === 0 ? '#8b9693' : '#d9dfd9'}
              />
              {[-45, -22.5, 0, 22.5, 45].map((z) => (
                <Box
                  key={z}
                  p={[side * (40 + r * 0.75), 1.43 + r * 0.7, z]}
                  size={[0.83, 0.07, 1.2]}
                  color="#8b9793"
                />
              ))}
            </group>
          ))}
          <Box p={[side * 56, 14.6, 0]} size={[1, 1.5, 113]} color="#4a5754" />
          {Array.from({ length: 15 }, (_, i) => {
            const z = -70 + i * 10;
            return (
              <group key={i}>
                <Strut a={[side * 78, 29.8, z]} b={[side * 36, 32, z]} />
                <Strut a={[side * 78, 27.8, z]} b={[side * 36, 30, z]} />
                <Strut a={[side * 37, 30, z]} b={[side * 37, 32, z]} />
                {[0, 1, 2, 3, 4, 5].map((j) => (
                  <Strut
                    key={j}
                    a={[side * (36 + j * 7), 30 - j * 0.36, z]}
                    b={[side * (43 + j * 7), 32 - (j + 1) * 0.36, z]}
                  />
                ))}
              </group>
            );
          })}
          {Array.from({ length: 21 }, (_, r) => (
            <Box
              key={r}
              p={[0, (1.35 + r * 0.6) / 2, side * (60 + r * 0.8)]}
              size={[79, 1.35 + r * 0.6, 0.9]}
              color={r % 7 === 0 ? '#8c9893' : '#dbe1da'}
            />
          ))}
          <Box p={[0, 7, side * 78.7]} size={[81, 14, 2]} color="#a5afa8" />
          <Box p={[0, 14.3, side * 81]} size={[89, 0.7, 8]} />
          <Box p={[0, 18, side * 81]} size={[25, 7, 0.65]} color="#d2d8d0" />
          <Box p={[0, 18, side * 80.6]} size={[23.8, 5.8, 0.15]} color="#111d21" />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <EndWall side={side} sx={sx} />
              <CornerInfill sx={sx} sz={side} />
            </group>
          ))}
          {/* Long exposed goal-end truss, suspended high above the low terrace. */}
          <Strut a={[-76, 30, side * 62]} b={[76, 30, side * 62]} width={0.35} />
          <Strut a={[-76, 32.3, side * 62]} b={[76, 32.3, side * 62]} width={0.3} />
          {Array.from({ length: 20 }, (_, j) => (
            <Strut
              key={j}
              a={[-76 + j * 7.6, 30, side * 62]}
              b={[-68.4 + j * 7.6, 32.3, side * 62]}
              width={0.16}
            />
          ))}
          {[-54, -36, 0, 36, 54].map((x) => (
            <Strut key={x} a={[x, 24, side * 62]} b={[x, 32.2, side * 62]} width={0.22} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <group key={i}>
              <Box p={[-36 + i * 12, 0.35, side * 89]} size={[1, 0.7, 12]} color="#a6ada4" />
              <Box p={[-36 + i * 12, 0.75, side * 93]} size={[1, 1.5, 4]} color="#b7bdb3" />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
