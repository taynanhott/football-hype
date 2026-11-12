import { Box3, Matrix4, InstancedMesh, Mesh, Object3D, Ray, Triangle, Vector3 } from 'three';
import type { CrowdSeat } from './stadium-seating';
type Surface = { a: Vector3; b: Vector3; c: Vector3 };
type Solid = { inverse: Matrix4; bounds: Box3; world: Box3 };
const CELL = 4;
const cache = new WeakMap<
  Object3D,
  { signature: string; filter: (seats: readonly CrowdSeat[]) => readonly CrowdSeat[] }
>();
/** Build once per architecture revision, then reuse the result when occupancy changes. */
export function clearCrowdSeats(root: Object3D, seats: readonly CrowdSeat[]): readonly CrowdSeat[] {
  root.updateWorldMatrix(true, true);
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && o.visible && !(o instanceof InstancedMesh)) meshes.push(o);
  });
  const signature = meshes
    .map((m) => m.uuid + ':' + m.geometry.uuid + ':' + m.matrixWorld.elements.join(','))
    .join('|');
  const existing = cache.get(root);
  if (existing?.signature === signature) return existing.filter(seats);
  const grid = new Map<string, Surface[]>(),
    solids: Solid[] = [];
  const cellKey = (x: number, y: number, z: number) => x + ',' + y + ',' + z;
  const ranges = (box: Box3, fn: (x: number, y: number, z: number) => void) => {
    for (let x = Math.floor(box.min.x / CELL); x <= Math.floor(box.max.x / CELL); x++)
      for (let y = Math.floor(box.min.y / CELL); y <= Math.floor(box.max.y / CELL); y++)
        for (let z = Math.floor(box.min.z / CELL); z <= Math.floor(box.max.z / CELL); z++)
          fn(x, y, z);
  };
  const bounds = new Box3();
  for (const mesh of meshes) {
    const geometry = mesh.geometry,
      p = geometry.getAttribute('position');
    if (!p) continue;
    geometry.computeBoundingBox();
    if (geometry.type === 'BoxGeometry' && geometry.boundingBox)
      solids.push({
        inverse: mesh.matrixWorld.clone().invert(),
        bounds: geometry.boundingBox.clone(),
        world: geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),
      });
    const index = geometry.getIndex(),
      count = index?.count ?? p.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const vertices = [0, 1, 2].map((k) =>
        new Vector3()
          .fromBufferAttribute(p, index ? index.getX(i + k) : i + k)
          .applyMatrix4(mesh.matrixWorld),
      );
      const surface = { a: vertices[0]!, b: vertices[1]!, c: vertices[2]! };
      bounds.setFromPoints(vertices);
      ranges(bounds, (x, y, z) => {
        const key = cellKey(x, y, z),
          bucket = grid.get(key);
        if (bucket) bucket.push(surface);
        else grid.set(key, [surface]);
      });
    }
  }
  const filtered = new WeakMap<readonly CrowdSeat[], readonly CrowdSeat[]>();
  const filter = (input: readonly CrowdSeat[]): readonly CrowdSeat[] => {
    const cached = filtered.get(input);
    if (cached) return cached;
    const worldBounds = new Box3(),
      body = new Box3(new Vector3(-0.44, 0.035, -0.18), new Vector3(0.44, 0.8, 0.18)),
      head = new Box3(new Vector3(-0.34, 0.7, -0.255), new Vector3(0.34, 1.26, 0.255));
    const triangle = new Triangle(),
      point = new Vector3(),
      ray = new Ray(new Vector3(), new Vector3(0, -1, 0)),
      candidates = new Set<Surface>();
    const result = input.flatMap((seat): CrowdSeat[] => {
      let foot = seat.y - 0.425;
      const c = Math.cos(seat.rotation),
        s = Math.sin(seat.rotation);
      worldBounds.set(
        new Vector3(seat.x - 0.52, foot - 0.08, seat.z - 0.52),
        new Vector3(seat.x + 0.52, foot + 1.51, seat.z + 0.52),
      );
      // Detect a spectator wholly inside a solid box, even when no face crosses their body.
      for (const solid of solids)
        if (solid.world.intersectsBox(worldBounds))
          for (const y of [foot + 0.12, foot + 0.65, foot + 1.12]) {
            point.set(seat.x, y, seat.z).applyMatrix4(solid.inverse);
            if (solid.bounds.containsPoint(point)) return [];
          }
      candidates.clear();
      ranges(worldBounds, (x, y, z) => {
        for (const face of grid.get(cellKey(x, y, z)) ?? []) candidates.add(face);
      });
      // Empty space is not a seat: require a tread immediately below the feet.
      ray.origin.set(seat.x, foot + 0.04, seat.z);
      let supported = false;
      for (const face of candidates)
        if (
          ray.intersectTriangle(face.a, face.b, face.c, false, point) &&
          Math.abs(point.y - foot) < 0.08
        ) {
          supported = true;
          break;
        }
      if (!supported) return [];
      // On curved transitions, fit both feet to the local cross-slope instead of removing the entire corner.
      const baseline = foot;
      for (const offset of [-0.28, 0.28]) {
        ray.origin.set(seat.x + c * offset, baseline + 0.22, seat.z - s * offset);
        for (const face of candidates)
          if (
            ray.intersectTriangle(face.a, face.b, face.c, false, point) &&
            Math.abs(point.y - baseline) < 0.2
          )
            foot = Math.max(foot, point.y);
      }
      const local = (v: Vector3, target: Vector3) => {
        const dx = v.x - seat.x,
          dz = v.z - seat.z;
        return target.set(c * dx - s * dz, v.y - foot, s * dx + c * dz);
      };
      for (const face of candidates) {
        local(face.a, triangle.a);
        local(face.b, triangle.b);
        local(face.c, triangle.c);
        if (body.intersectsTriangle(triangle) || head.intersectsTriangle(triangle)) return [];
      }
      return [foot > baseline + 0.001 ? { ...seat, y: foot + 0.425 } : seat];
    });
    filtered.set(input, result);
    return result;
  };
  cache.set(root, { signature, filter });
  return filter(seats);
}
