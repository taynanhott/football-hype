import { vilaOutline, vilaAisles, VILA_ROWS, type VilaPoint } from './vila-belmiro-layout';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, SRGBColorSpace } from 'three';

function Box({
  p,
  size,
  color = '#eeeDE7',
}: {
  p: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function FacadeBand({ y, height, color }: { y: number; height: number; color: string }) {
  const shape = useMemo(() => {
    return vilaOutline(1, true).map(([x, , z]) => ({ x, y: z }));
  }, []);
  const geometry = useMemo(() => {
    const v: number[] = [];
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i]!,
        b = shape[(i + 1) % shape.length]!;
      v.push(
        a.x,
        y,
        a.y,
        b.x,
        y,
        b.y,
        a.x,
        y + height,
        a.y,
        b.x,
        y,
        b.y,
        b.x,
        y + height,
        b.y,
        a.x,
        y + height,
        a.y,
      );
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [shape, y, height]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} side={2} />
    </mesh>
  );
}

function VilaBowl() {
  const { terraces, structure, aisles } = useMemo(() => {
    const dark: number[] = [],
      concrete: number[] = [],
      yellow: number[] = [];
    const quad = (v: number[], a: VilaPoint, b: VilaPoint, c: VilaPoint, d: VilaPoint) =>
      v.push(...a, ...b, ...c, ...b, ...d, ...c);
    for (let r = 0; r < VILA_ROWS; r++) {
      const f = r / (VILA_ROWS - 1),
        lo = Math.max(0, (r - 0.5) / (VILA_ROWS - 1)),
        hi = (r + 0.5) / (VILA_ROWS - 1);
      const inner = vilaOutline(lo),
        outer = vilaOutline(hi),
        level = vilaOutline(f);
      const prev = vilaOutline(Math.max(0, (r - 1) / (VILA_ROWS - 1)));
      for (let i = 0; i < inner.length; i++) {
        const j = (i + 1) % inner.length;
        const at = (points: VilaPoint[], k: number, y: number): VilaPoint => [
          points[k]![0],
          y,
          points[k]![2],
        ];
        const a = at(inner, i, level[i]![1]),
          b = at(inner, j, level[j]![1]);
        const c = at(outer, i, level[i]![1]),
          d = at(outer, j, level[j]![1]);
        quad(dark, a, b, c, d);
        const nose = (p: VilaPoint, q: VilaPoint): VilaPoint => [
          p[0] + (q[0] - p[0]) * 0.1,
          p[1] + 0.008,
          p[2] + (q[2] - p[2]) * 0.1,
        ];
        quad(
          concrete,
          [a[0], a[1] + 0.008, a[2]],
          [b[0], b[1] + 0.008, b[2]],
          nose(a, c),
          nose(b, d),
        );
        // Closed risers and the front retaining wall replace floating tread strips.
        quad(
          r === 0 ? concrete : dark,
          a,
          at(inner, i, r === 0 ? 0 : prev[i]![1]),
          b,
          at(inner, j, r === 0 ? 0 : prev[j]![1]),
        );
        if (i % 17 === 16) {
          // Narrow stair aisles across each straight sector, on the same tread surface.
          const lerp = (a: VilaPoint, b: VilaPoint, t: number): VilaPoint =>
            a.map((v, k) => v + (b[k]! - v) * t + (k === 1 ? 0.025 : 0)) as VilaPoint;
          for (const t of vilaAisles(i))
            quad(
              yellow,
              lerp(a, b, t - 0.008),
              lerp(a, b, t + 0.008),
              lerp(c, d, t - 0.008),
              lerp(c, d, t + 0.008),
            );
        }
      }
    }
    const last = vilaOutline((VILA_ROWS - 0.5) / (VILA_ROWS - 1)),
      rear = vilaOutline(1, true),
      top = vilaOutline(1);
    for (let i = 0; i < rear.length; i++) {
      const j = (i + 1) % rear.length;
      const p = (outline: VilaPoint[], k: number, y: number): VilaPoint => [
        outline[k]![0],
        y,
        outline[k]![2],
      ];
      quad(concrete, p(last, i, top[i]![1]), p(last, j, top[j]![1]), rear[i]!, rear[j]!);
      const inset = (k: number, y: number): VilaPoint => [
        rear[k]![0] * 0.998,
        y,
        rear[k]![2] * 0.998,
      ];
      quad(concrete, inset(i, rear[i]![1]), inset(i, 0), inset(j, rear[j]![1]), inset(j, 0));
    }
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return { terraces: geometry(dark), structure: geometry(concrete), aisles: geometry(yellow) };
  }, []);
  useEffect(
    () => () => {
      terraces.dispose();
      structure.dispose();
      aisles.dispose();
    },
    [terraces, structure, aisles],
  );
  return (
    <group name="Arquibancada contínua com estrutura fechada">
      <mesh geometry={terraces} receiveShadow castShadow>
        <meshStandardMaterial color="#343939" side={2} />
      </mesh>
      <mesh geometry={structure} receiveShadow castShadow>
        <meshStandardMaterial color="#c7c8bf" side={2} />
      </mesh>
      <mesh geometry={aisles} receiveShadow>
        <meshStandardMaterial color="#c8b86a" side={2} />
      </mesh>
    </group>
  );
}

function VilaSigns() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eeede7';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#202426';
    ctx.textAlign = 'center';
    ctx.font = '52px Georgia';
    ctx.fillText('SANTOS FUTEBOL CLUBE', 512, 87);
    ctx.font = '30px Georgia';
    ctx.fillText('ESTÁDIO URBANO CALDEIRA', 512, 165);
    ctx.font = '26px Georgia';
    ctx.fillText('VILA BELMIRO', 512, 216);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 8, 79.12]}>
      <planeGeometry args={[32, 8]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

export function VilaBelmiro() {
  return (
    <group name="Vila Belmiro — Urbano Caldeira">
      <FacadeBand y={0} height={2.3} color="#dddcd5" />
      <FacadeBand y={2.3} height={1.6} color="#242729" />
      <FacadeBand y={3.9} height={3.4} color="#f0eee8" />
      <FacadeBand y={7.3} height={1.5} color="#222729" />
      <FacadeBand y={8.8} height={3.4} color="#efeee8" />
      <VilaSigns />
      <VilaBowl />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[side * 59, side === -1 ? 13 : 8, 0]} size={[3, side === -1 ? 26 : 16, 120]} />
          {[4, 8, 12].map((y) => (
            <Box key={y} p={[side * 60.6, y, 0]} size={[0.12, 1.2, 118]} color="#272c2e" />
          ))}
          {/* Narrow rear walkways leave most of the terraces uncovered. */}
          <Box p={[side * 56.5, side === -1 ? 22.6 : 14.2, 0]} size={[8, 0.65, 122]} />
          {Array.from({ length: 17 }, (_, i) => (
            <group key={i}>
              <Box
                p={[side * 59, side === -1 ? 24 : 15.6, -58 + i * 7.25]}
                size={[0.17, 2.8, 0.17]}
                color="#444944"
              />
              <Box
                p={[side * 59, side === -1 ? 25.2 : 16.8, -58 + i * 7.25]}
                size={[0.22, 0.2, 7.3]}
                color="#444944"
              />
            </group>
          ))}
        </group>
      ))}
      {/* Only the middle of the social stand has a deep roof. */}
      <Box p={[-50, 23, 0]} size={[22, 0.8, 60]} color="#e6e5df" />
      <Box p={[-58, 25, -32]} size={[6, 4, 15]} color="#e2e2dc" />
      {/* Freestanding scoreboard above the lower goal terrace. */}
      <Box p={[0, 17.3, 72]} size={[18, 11, 0.8]} color="#555c59" />
      <Box p={[0, 17.3, 71.5]} size={[16.4, 9.4, 0.15]} color="#1f2929" />
      {[-7, 7].map((x) => (
        <Box key={x} p={[x, 11.5, 72]} size={[0.5, 10, 0.6]} color="#696e68" />
      ))}
      {[-27, -22, -17].map((x) => (
        <Box key={x} p={[x, 16, 77]} size={[0.13, 12, 0.13]} color="#c9cec7" />
      ))}
    </group>
  );
}
