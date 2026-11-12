import { vascoCrossVertices } from './vasco-cross';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import {
  SAO_JANUARIO_ROWS,
  SAO_JANUARIO_STEP,
  saoJanuarioHeight,
  saoJanuarioOutline,
  saoJanuarioPaint,
} from './sao-januario-layout';
type Point = [number, number, number];
export function SaoJanuario() {
  const meshes = useMemo(() => {
    const white: number[] = [],
      black: number[] = [],
      red: number[] = [],
      stone: number[] = [],
      steel: number[] = [],
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
        len = d.length();
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()),
        mid = new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5);
      const raw: number[] = [];
      box(raw, [0, 0, 0], [w, len, w]);
      for (let i = 0; i < raw.length; i += 3) {
        const p = new Vector3(raw[i]!, raw[i + 1]!, raw[i + 2]!).applyQuaternion(q).add(mid);
        v.push(p.x, p.y, p.z);
      }
    };
    for (let row = 0; row < SAO_JANUARIO_ROWS; row++) {
      const y = saoJanuarioHeight(row),
        inner = saoJanuarioOutline(row * SAO_JANUARIO_STEP, y),
        outer = saoJanuarioOutline((row + 1) * SAO_JANUARIO_STEP, y);
      for (let i = 0; i < inner.length - 1; i++) {
        const color = saoJanuarioPaint(row, i),
          target = color === 'red' ? red : color === 'white' ? white : black;
        quad(target, inner[i]!, inner[i + 1]!, outer[i]!, outer[i + 1]!);
        const low = row === 0 ? 0 : saoJanuarioHeight(row - 1);
        quad(target, inner[i]!, [inner[i]![0], low, inner[i]![2]], inner[i + 1]!, [
          inner[i + 1]![0],
          low,
          inner[i + 1]![2],
        ]);
      }
      // Solid end cheeks close the two straight stands without adding a southern terrace.
      for (const i of [0, inner.length - 1])
        quad(
          stone,
          inner[i]!,
          outer[i]!,
          [inner[i]![0], 0, inner[i]![2]],
          [outer[i]![0], 0, outer[i]![2]],
        );
    }
    red.push(...vascoCrossVertices());
    const rear = saoJanuarioOutline(24, 14.2),
      last = saoJanuarioOutline(SAO_JANUARIO_ROWS * SAO_JANUARIO_STEP, saoJanuarioHeight(31));
    for (let i = 0; i < rear.length - 1; i++) {
      quad(stone, last[i]!, last[i + 1]!, rear[i]!, rear[i + 1]!);
      quad(stone, rear[i]!, [rear[i]![0], 0, rear[i]![2]], rear[i + 1]!, [
        rear[i + 1]![0],
        0,
        rear[i + 1]![2],
      ]);
    }
    // Historic social stand: narrow cantilever roof and repeated exposed concrete ribs.
    box(stone, [-58, 15.5, 8.5], [20, 0.65, 101]);
    for (let j = 0; j < 25; j++) {
      const z = -40 + j * 4;
      beam(stone, [-68, 17, z], [-48, 15.7, z], 0.38);
      box(steel, [-48, 15.5, z], [0.13, 0.13, 4]);
    }
    box(stone, [-67, 6.2, 8.5], [3, 12.4, 101]);
    // Repeated arched dark windows in the pale historic facade.
    for (let j = 0; j < 24; j++) {
      const z = -38 + j * 4;
      box(glass, [-68.6, 6, z], [0.16, 3.4, 1.8]);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI,
          b = ((k + 1) / 8) * Math.PI;
        quad(
          glass,
          [-68.7, 7.7, z],
          [-68.7, 7.7 + 0.9 * Math.sin(a), z + 0.9 * Math.cos(a)],
          [-68.7, 7.7 + 0.9 * Math.sin(b), z + 0.9 * Math.cos(b)],
          [-68.7, 7.7, z],
        );
      }
    }
    box(stone, [-68.5, 8, 8], [5, 16, 12]);
    box(stone, [-68.5, 16.7, 8], [7, 1.4, 14]);
    box(red, [-71.1, 11, 8], [0.2, 4, 1]);
    box(red, [-71.2, 11, 8], [0.2, 1, 4]);
    // The uncovered northern rim retains the exposed radial concrete buttresses.
    for (let j = 0; j <= 32; j++) {
      const a = Math.PI + (j / 32) * Math.PI;
      beam(
        stone,
        [Math.cos(a) * 59, 14, -40 + Math.sin(a) * 52],
        [Math.cos(a) * 67, 15.7, -40 + Math.sin(a) * 60],
        0.35,
      );
    }
    // Tall open lattice lighting structures behind the eastern terrace.
    for (const z of [-27, 39]) {
      for (const dz of [-1, 1]) beam(steel, [69, 0, z + dz], [69, 28, z + dz], 0.22);
      for (let j = 0; j < 9; j++) beam(steel, [69, j * 3, z - 1], [69, (j + 1) * 3, z + 1], 0.13);
    }
    beam(steel, [69, 28, -30], [69, 28, 43], 0.32);
    beam(steel, [69, 30, -30], [69, 30, 43], 0.24);
    for (let j = 0; j < 24; j++) beam(steel, [69, 28, -30 + j * 3], [69, 30, -27 + j * 3], 0.14);
    // Freestanding scoreboard in the open end, beyond the playing field.
    box(black, [0, 16.5, 73], [20, 8, 0.8]);
    for (const x of [-7, 7]) {
      box(steel, [x, 6.4, 73], [1, 12.8, 1.2]);
      box(stone, [x, 0.3, 73], [3, 0.6, 3]);
    }
    for (const x of [-23, 23]) {
      box(glass, [x, 1.5, 70], [8, 2.8, 3]);
      box(steel, [x, 3, 70], [8.6, 0.2, 3.5]);
    }
    // Low fence follows the empty goal end rather than enclosing it with seating.
    for (let j = 0; j < 40; j++) {
      const a = (j / 40) * Math.PI,
        b = ((j + 1) / 40) * Math.PI;
      const p: Point = [42 * Math.cos(a), 2.2, 57 + 23 * Math.sin(a)],
        q: Point = [42 * Math.cos(b), 2.2, 57 + 23 * Math.sin(b)];
      beam(steel, p, q, 0.1);
      beam(steel, [p[0], 0, p[2]], p, 0.1);
    }
    const geometry = (v: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      return g;
    };
    return [white, black, red, stone, steel, glass].map(geometry);
  }, []);
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  return (
    <group name="São Januário — ferradura e mosaicos do Vasco">
      {meshes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={['#e6e7df', '#292f30', '#a32c35', '#c8c5b5', '#818e8b', '#426166'][i]!}
            side={2}
            roughness={0.86}
          />
        </mesh>
      ))}
    </group>
  );
}
