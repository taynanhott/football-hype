import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import { clearCrowdSeats, smokePlumeLimit, crowdBoxClearance } from '../src/three/crowd-clearance';
import type { CrowdSeat } from '../src/three/stadium-seating';
const seat = (x = 0, y = 0.425, z = 0): CrowdSeat => ({ x, y, z, rotation: 0 });
const box = (root: Group, x: number, y: number, z: number, w: number, h: number, d: number) => {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  mesh.position.set(x, y, z);
  root.add(mesh);
  return mesh;
};
describe('folga da torcida em relação às estruturas', () => {
  it('bloqueia pulos e bandeiras quando há vigas no espaço da animação', () => {
    const root = new Group();
    box(root, 0, -0.5, 0, 100, 1, 100);
    const beam = box(root, 0, 1.55, 0, 5, 0.2, 5);
    expect(crowdBoxClearance(root)(seat(), 1.05, 1.65, 0.43)).toBe(false);
    beam.position.y = 4;
    expect(crowdBoxClearance(root)(seat(), 1.05, 1.65, 0.43)).toBe(true);
    expect(crowdBoxClearance(root)(seat(), 2.4, 4.85, 1.8)).toBe(false);
  });
  it('limita a pluma inteira antes do teto e recusa um emissor sem espaço inicial', () => {
    const root = new Group();
    box(root, 0, -0.5, 0, 100, 1, 100);
    const roof = box(root, 0, 12, 0, 100, 0.4, 100);
    const limit = smokePlumeLimit(root)(seat(), [1.5, 1, 0]);
    expect(limit).toBeGreaterThan(0.18);
    expect(limit).toBeLessThan(1);
    const top = 0.425 + 1.35 + limit * 12 + 2 + limit * 7.5 + Math.SQRT2 * (0.12 + limit * 1.4);
    expect(top).toBeLessThan(11.8);
    roof.position.y = 3;
    expect(smokePlumeLimit(root)(seat(), [1.5, 1, 0])).toBe(0);
    roof.position.y = 1.5;
    expect(smokePlumeLimit(root)(seat(), [1.5, 1, 0])).toBe(0);
    root.remove(roof);
    expect(smokePlumeLimit(root)(seat(), [1.5, 1, 0])).toBe(1);
  });
  it('ajusta os pés à inclinação transversal de uma quina sem esvaziar a fileira', () => {
    const root = new Group();
    const tread = new Mesh(new PlaneGeometry(4, 4), new MeshBasicMaterial());
    tread.rotation.set(-Math.PI / 2, 0.2, 0);
    root.add(tread);
    const fitted = clearCrowdSeats(root, [seat()]);
    expect(fitted).toHaveLength(1);
    expect(fitted[0]!.y).toBeGreaterThanOrEqual(0.425);
    expect(fitted[0]!.y).toBeLessThan(0.625);
  });
  it('exclui assentos suspensos e fora do degrau', () => {
    const root = new Group();
    box(root, 0, -0.5, 0, 2, 1, 2);
    expect(clearCrowdSeats(root, [seat(), seat(4), seat(0, 2)])).toEqual([seat()]);
  });
  it('preserva o degrau e exclui apenas torcedores que cruzam pilares e cobertura', () => {
    const root = new Group();
    box(root, 0, -0.5, 0, 12, 1, 12);
    box(root, 2, 2, 0, 1, 4, 1);
    box(root, -2, 1.1, 0, 1, 0.2, 1);
    const seats = [seat(), seat(2), seat(-2), seat(4)];
    expect(clearCrowdSeats(root, seats)).toEqual([seats[0], seats[3]]);
  });
  it('detecta corpo totalmente dentro de uma parede e estruturas transformadas', () => {
    const root = new Group();
    root.scale.set(0.8, 0.7, 0.8);
    root.rotation.y = Math.PI / 4;
    box(root, 0, -0.5, 0, 50, 1, 50);
    box(root, 0, 3, 0, 6, 6, 6);
    expect(clearCrowdSeats(root, [seat(), seat(8)])).toEqual([seat(8)]);
  });
  it('detecta um painel sem espessura e invalida o cache quando a estrutura muda', () => {
    const root = new Group(),
      wall = new Mesh(new PlaneGeometry(3, 3), new MeshBasicMaterial());
    box(root, 0, -0.5, 0, 50, 1, 50);
    wall.position.y = 1;
    root.add(wall);
    const seats = [seat(), seat(5)];
    const first = clearCrowdSeats(root, seats);
    expect(first).toEqual([seats[1]]);
    expect(clearCrowdSeats(root, seats)).toBe(first);
    wall.position.z = 10;
    expect(clearCrowdSeats(root, seats)).toEqual(seats);
  });
});

it('reconhece degraus instanciados e invalida o mapa após mover uma instância', () => {
  const root = new Group(),
    mesh = new InstancedMesh(new BoxGeometry(4, 1, 2), new MeshBasicMaterial(), 1);
  mesh.setMatrixAt(0, new Matrix4().makeTranslation(0, -0.5, 0));
  mesh.instanceMatrix.needsUpdate = true;
  root.add(mesh);
  const seats = [seat()];
  expect(clearCrowdSeats(root, seats)).toHaveLength(1);
  mesh.setMatrixAt(0, new Matrix4().makeTranslation(10, -0.5, 0));
  mesh.instanceMatrix.needsUpdate = true;
  expect(clearCrowdSeats(root, seats)).toHaveLength(0);
});
