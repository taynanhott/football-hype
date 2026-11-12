import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { LEVEL_TWO_ROWS, levelTwoOutline, type LevelTwoPoint } from './level-two-layout';
export function LevelTwoStadium() {
  const meshes = useMemo(() => {
    const seats: number[] = [],
      concrete: number[] = [],
      stairs: number[] = [],
      grass: number[] = [],
      dark: number[] = [];
    const quad = (
      v: number[],
      a: LevelTwoPoint,
      b: LevelTwoPoint,
      c: LevelTwoPoint,
      d: LevelTwoPoint,
    ) => v.push(...a, ...b, ...c, ...b, ...d, ...c);
    const box = (v: number[], p: LevelTwoPoint, s: LevelTwoPoint) => {
      const ps = Array.from(
        { length: 8 },
        (_, i) => p.map((n, k) => n + ((i & (1 << k) ? 1 : -1) * s[k]!) / 2) as LevelTwoPoint,
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
    const setHeight = (p: LevelTwoPoint, y: number): LevelTwoPoint => [p[0], y, p[2]];
    for (let row = 0; row < LEVEL_TWO_ROWS; row++) {
      const lo = Math.max(0, (row - 0.5) / (LEVEL_TWO_ROWS - 1)),
        hi = (row + 0.5) / (LEVEL_TWO_ROWS - 1),
        f = row / (LEVEL_TWO_ROWS - 1);
      const inner = levelTwoOutline(lo),
        outer = levelTwoOutline(hi),
        level = levelTwoOutline(f),
        previous = levelTwoOutline(Math.max(0, (row - 1) / (LEVEL_TWO_ROWS - 1)));
      for (let i = 0; i < inner.length; i++) {
        const j = (i + 1) % inner.length,
          a = setHeight(inner[i]!, level[i]![1]),
          b = setHeight(inner[j]!, level[j]![1]),
          c = setHeight(outer[i]!, level[i]![1]),
          d = setHeight(outer[j]!, level[j]![1]);
        quad(i % 17 === 8 ? stairs : seats, a, b, c, d);
        quad(
          concrete,
          a,
          setHeight(a, row === 0 ? 0 : previous[i]![1]),
          b,
          setHeight(b, row === 0 ? 0 : previous[j]![1]),
        );
        if (i % 17 === 16) {
          const lerp = (p: LevelTwoPoint, q: LevelTwoPoint, t: number): LevelTwoPoint =>
            p.map((n, k) => n + (q[k]! - n) * t + (k === 1 ? 0.025 : 0)) as LevelTwoPoint;
          for (const t of [0.2, 0.4, 0.6, 0.8])
            quad(
              stairs,
              lerp(a, b, t - 0.012),
              lerp(a, b, t + 0.012),
              lerp(c, d, t - 0.012),
              lerp(c, d, t + 0.012),
            );
        }
      }
    }
    const inner = levelTwoOutline((LEVEL_TWO_ROWS - 0.5) / (LEVEL_TWO_ROWS - 1)),
      rear = levelTwoOutline(1, true),
      top = levelTwoOutline(1);
    for (let i = 0; i < rear.length; i++) {
      const j = (i + 1) % rear.length;
      quad(
        concrete,
        setHeight(inner[i]!, top[i]![1]),
        setHeight(inner[j]!, top[j]![1]),
        rear[i]!,
        rear[j]!,
      );
      // A planted embankment supports the bowl; retaining walls close the outside volume.
      const p: LevelTwoPoint = [rear[i]![0] * 1.06, 0.3, rear[i]![2] * 1.04],
        q: LevelTwoPoint = [rear[j]![0] * 1.06, 0.3, rear[j]![2] * 1.04];
      quad(grass, rear[i]!, rear[j]!, p, q);
      quad(concrete, p, q, setHeight(p, 0), setHeight(q, 0));
    }
    // Open-air stadium: no roof or upper deck, with a simple scoreboard and corner lights.
    box(dark, [0, 9, 85], [15, 5, 0.7]);
    for (const x of [-5, 5]) box(concrete, [x, 3.5, 85], [0.45, 7, 0.65]);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        box(concrete, [sx * 64, 9, sz * 76], [0.45, 18, 0.45]);
        box(dark, [sx * 64, 18.6, sz * 76], [5, 1.7, 0.6]);
      }
    const geometry = (vertices: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    };
    return [seats, concrete, stairs, grass, dark].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group name="Estádio nível 2 — arquibancadas descobertas e talude">
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={['#79b8d5', '#aeb5a8', '#c9bd79', '#788b58', '#334346'][i]!}
            side={2}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
