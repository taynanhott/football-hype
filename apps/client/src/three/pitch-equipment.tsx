import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
function netGeometry() {
  const vertices: number[] = [];
  type Point = [number, number, number];
  const panel = (w: number, h: number, map: (u: number, v: number) => Point) => {
    const radius = 0.085,
      dx = Math.sqrt(3) * radius,
      dy = radius * 1.5;
    for (let row = -1; row <= Math.ceil(h / dy) + 1; row++)
      for (let col = -1; col <= Math.ceil(w / dx) + 1; col++) {
        const cx = (col + (row & 1) * 0.5) * dx,
          cy = row * dy;
        // Three unique edges per cell: a hexagonal mesh without triangulation diagonals.
        for (let edge = 0; edge < 3; edge++) {
          const a = ((edge * 60 - 30) * Math.PI) / 180,
            b = (((edge + 1) * 60 - 30) * Math.PI) / 180;
          const x = cx + radius * Math.cos(a),
            y = cy + radius * Math.sin(a),
            vx = radius * (Math.cos(b) - Math.cos(a)),
            vy = radius * (Math.sin(b) - Math.sin(a));
          let lo = 0,
            hi = 1;
          for (const [p, q] of [
            [-vx, x],
            [vx, w - x],
            [-vy, y],
            [vy, h - y],
          ]) {
            if (Math.abs(p!) < 1e-10) {
              if (q! < 0) {
                lo = 1;
                hi = 0;
                break;
              }
            } else {
              const t = q! / p!;
              if (p! < 0) lo = Math.max(lo, t);
              else hi = Math.min(hi, t);
            }
          }
          if (lo <= hi)
            vertices.push(...map(x + vx * lo, y + vy * lo), ...map(x + vx * hi, y + vy * hi));
        }
      }
  };
  panel(7.32, 2.3, (u, v) => [
    u - 3.66,
    v + 0.025,
    2.25 - (0.25 * v) / 2.3 + 0.09 * Math.sin((u / 7.32) * Math.PI) * Math.sin((v / 2.3) * Math.PI),
  ]);
  panel(7.32, 2, (u, v) => [
    u - 3.66,
    2.44 - (0.14 * v) / 2 - 0.06 * Math.sin((u / 7.32) * Math.PI) * Math.sin((v / 2) * Math.PI),
    v,
  ]);
  for (const side of [-1, 1])
    panel(2.25, 2.44, (u, v) => [
      side * (3.66 + 0.06 * Math.sin((u / 2.25) * Math.PI) * Math.sin((v / 2.44) * Math.PI)),
      v * (1 - (0.14 * u) / 2.25 / 2.44),
      u * (1 - (0.25 * v) / 2.44 / 2.25),
    ]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  return g;
}
function Goal() {
  const net = useMemo(() => netGeometry(), []);
  useEffect(() => () => net.dispose(), [net]);
  return (
    <group name="Gol com rede hexagonal">
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 3.66, 1.22, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 2.44, 12]} />
          <meshStandardMaterial color="#f5f5eb" />
        </mesh>
      ))}
      <mesh position={[0, 2.44, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 7.44, 12]} />
        <meshStandardMaterial color="#f5f5eb" />
      </mesh>
      <lineSegments geometry={net}>
        <lineBasicMaterial color="#eeeee4" transparent opacity={0.86} />
      </lineSegments>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 3.74, 1.17, 2.28]}>
          <cylinderGeometry args={[0.025, 0.025, 2.34, 6]} />
          <meshStandardMaterial color="#9da9a0" />
        </mesh>
      ))}
    </group>
  );
}
export function PitchEquipment() {
  return (
    <group name="Gols e bandeirinhas">
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[0, 0, side * 52.5]}
          rotation={[0, side === 1 ? 0 : Math.PI, 0]}
        >
          <Goal />
        </group>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={sx + ':' + sz} position={[sx * 34, 0, sz * 52.5]}>
            <mesh position={[0, 0.82, 0]}>
              <cylinderGeometry args={[0.018, 0.022, 1.64, 6]} />
              <meshStandardMaterial color="#e7e8dc" />
            </mesh>
            <mesh position={[sx * 0.22, 1.46, 0]} rotation={[0, (sz * Math.PI) / 5, 0]}>
              <planeGeometry args={[0.44, 0.3, 3, 2]} />
              <meshStandardMaterial color={sx === sz ? '#e4c546' : '#e58335'} side={2} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
