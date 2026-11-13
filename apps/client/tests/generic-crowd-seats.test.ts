import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { genericCrowdSeats } from '../src/three/generic-crowd-seats';
import { clearCrowdSeats } from '../src/three/crowd-clearance';
describe('torcida nas arquibancadas genéricas', () => {
  for (const level of [1, 3])
    it('preenche todos os andares e degraus do nível ' + level, () => {
      const root = new Group(),
        rows = 5 + level * 2,
        tiers = level === 3 ? 2 : 1;
      for (let tier = 0; tier < tiers; tier++)
        for (let row = 0; row < rows; row++) {
          const mesh = new Mesh(new BoxGeometry(78, 1.2, 2), new MeshBasicMaterial());
          mesh.position.set(0, tier * 10 + 1 + row * 0.7, -63 * (tier ? 1.08 : 1) - row * 0.95);
          root.add(mesh);
        }
      const seats = genericCrowdSeats(level).filter((s) => s.z < 0 && Math.abs(s.x) < 39);
      expect(clearCrowdSeats(root, seats)).toHaveLength(seats.length);
      expect(new Set(seats.map((s) => s.y)).size).toBe(rows * tiers);
    });
});
