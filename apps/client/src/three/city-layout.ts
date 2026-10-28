export type CityPart = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: number;
};
export type CityRoad = { axis: 'x' | 'z'; cross: number; from: number; to: number; width: number };
export type CityBuilding = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  kind: 'house' | 'apartment' | 'office';
};
export type CityTree = { x: number; z: number; size: number };
export function cityReserved(x: number, z: number, margin = 0) {
  return (
    (x > -150 - margin && x < 94 + margin && z > -125 - margin && z < 145 + margin) ||
    (x > 100 - margin && x < 295 + margin && z > -122 - margin && z < 122 + margin)
  );
}
type StreetRect = { x1: number; x2: number; z1: number; z2: number; asphalt: boolean };
// Partition the street network into non-overlapping surfaces, including junctions.
function streetSurfaces(roads: CityRoad[]): StreetRect[] {
  const rectangles = roads.flatMap((r) =>
    [0, 4].map((padding) => {
      const half = r.width / 2 + padding;
      return r.axis === 'x'
        ? { x1: r.from, x2: r.to, z1: r.cross - half, z2: r.cross + half, asphalt: padding === 0 }
        : { x1: r.cross - half, x2: r.cross + half, z1: r.from, z2: r.to, asphalt: padding === 0 };
    }),
  );
  const xs = [...new Set(rectangles.flatMap((r) => [r.x1, r.x2]))].sort((a, b) => a - b);
  const surfaces: StreetRect[] = [];
  let previous = new Map<string, StreetRect>();
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i]!,
      x2 = xs[i + 1]!,
      middle = (x1 + x2) / 2;
    const active = rectangles.filter((r) => middle > r.x1 && middle < r.x2);
    const zs = [...new Set(active.flatMap((r) => [r.z1, r.z2]))].sort((a, b) => a - b);
    const spans: StreetRect[] = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const z1 = zs[j]!,
        z2 = zs[j + 1]!,
        z = (z1 + z2) / 2;
      const covering = active.filter((r) => z > r.z1 && z < r.z2);
      if (!covering.length) continue;
      const asphalt = covering.some((r) => r.asphalt),
        last = spans.at(-1);
      if (last && last.z2 === z1 && last.asphalt === asphalt) last.z2 = z2;
      else spans.push({ x1, x2, z1, z2, asphalt });
    }
    const next = new Map<string, StreetRect>();
    for (const span of spans) {
      const key = [span.z1, span.z2, span.asphalt].join(':'),
        prior = previous.get(key);
      if (prior && prior.x2 === x1) {
        prior.x2 = x2;
        next.set(key, prior);
      } else {
        surfaces.push(span);
        next.set(key, span);
      }
    }
    previous = next;
  }
  return surfaces;
}
export function createCityLayout(seed = 17) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const boxes: CityPart[] = [],
    windows: CityPart[] = [],
    roofs: CityPart[] = [],
    trunks: CityPart[] = [],
    canopies: CityPart[] = [];
  const buildings: CityBuilding[] = [],
    trees: CityTree[] = [],
    roads: CityRoad[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    rotation = 0,
  ) => boxes.push({ position: [x, y, z], scale: [w, h, d], color, rotation });
  const road = (axis: CityRoad['axis'], cross: number, from: number, to: number, width = 12) =>
    roads.push({ axis, cross, from, to, width });
  const xs = [-460, -360, -260, -156, -50, 50, 97.5, 200, 300, 400, 500];
  const zs = [-435, -335, -235, -135, -65, 65, 155, 255, 355, 455];
  for (const x of [-460, -360, -260, -156, 97.5, 300, 400, 500])
    road('z', x, -455, 475, x === 97.5 ? 8 : x === -156 || x === 300 ? 16 : 12);
  for (const x of [-50, 50, 200]) {
    road('z', x, -455, -135);
    road('z', x, 155, 475);
  }
  for (const z of [-435, -335, -235, -135, 155, 255, 355, 455])
    road('x', z, -480, 520, z === 155 ? 18 : 12);
  for (const z of [-65, 65]) {
    road('x', z, -480, -156);
    road('x', z, 300, 520);
  }
  const onRoad = (x: number, z: number, extra = 0) =>
    roads.some(
      (r) =>
        Math.abs((r.axis === 'x' ? z : x) - r.cross) < r.width / 2 + extra &&
        (r.axis === 'x' ? x : z) > r.from - extra &&
        (r.axis === 'x' ? x : z) < r.to + extra,
    );
  const junction = (r: CityRoad, along: number) =>
    roads.some(
      (other) =>
        other.axis !== r.axis &&
        along > other.cross - other.width / 2 - 5 &&
        along < other.cross + other.width / 2 + 5 &&
        r.cross >= other.from - 3 &&
        r.cross <= other.to + 3,
    );
  // The precinct and training campus have their own ground, clear of municipal buildings.
  box(10, -0.13, 10, 1020, 0.025, 960, '#aaa995');
  box(-4, -0.065, 9, 196, 0.06, 264, '#d4d0bf');
  for (const surface of streetSurfaces(roads)) {
    box(
      (surface.x1 + surface.x2) / 2,
      surface.asphalt ? 0.01 : 0.05,
      (surface.z1 + surface.z2) / 2,
      surface.x2 - surface.x1,
      surface.asphalt ? 0.08 : 0.12,
      surface.z2 - surface.z1,
      surface.asphalt ? '#60696b' : '#cbc6b7',
    );
  }
  for (const r of roads) {
    for (let t = r.from + 7; t < r.to - 5; t += 12)
      if (!junction(r, t)) {
        if (r.axis === 'x') box(t, 0.105, r.cross, 4, 0.02, 0.22, '#e0d8b9');
        else box(r.cross, 0.105, t, 0.22, 0.02, 4, '#e0d8b9');
      }
  }
  const intersections = new Set<string>();
  for (const v of roads.filter((r) => r.axis === 'z'))
    for (const h of roads.filter((r) => r.axis === 'x')) {
      if (v.cross < h.from || v.cross > h.to || h.cross < v.from || h.cross > v.to) continue;
      const key = `${v.cross}:${h.cross}`;
      if (intersections.has(key)) continue;
      intersections.add(key);
      for (const sign of [-1, 1]) {
        for (let offset = -v.width / 2 + 1; offset < v.width / 2; offset += 1.9)
          box(
            v.cross + offset,
            0.105,
            h.cross + sign * (h.width / 2 + 5),
            1,
            0.025,
            3.6,
            '#eee9db',
          );
        for (let offset = -h.width / 2 + 1; offset < h.width / 2; offset += 1.9)
          box(
            v.cross + sign * (v.width / 2 + 5),
            0.105,
            h.cross + offset,
            3.6,
            0.025,
            1,
            '#eee9db',
          );
      }
    }
  const facades = [
    '#cbbba0',
    '#e5ddc9',
    '#bc9e89',
    '#d6cbb3',
    '#b8bdba',
    '#b1b6a3',
    '#c7aba0',
    '#d9d0bd',
    '#a5b1b2',
  ];
  const roofColors = ['#9f6551', '#ac7458', '#80695b', '#b88764', '#7e8580'];
  const fits = (x: number, z: number, w: number, d: number) =>
    ![
      [x - w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
      [x + w / 2, z - d / 2],
      [x, z],
    ].some(([px, pz]) => cityReserved(px!, pz!, 4)) && !onRoad(x, z, Math.max(w, d) / 2 + 1);
  const addBuilding = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    kind: CityBuilding['kind'],
  ) => {
    buildings.push({ x, z, width, depth, height, kind });
    const color = facades[Math.floor(random() * facades.length)]!;
    box(x, height / 2 + 0.02, z, width, height, depth, color);
    box(x, 0.45, z, width + 0.45, 0.9, depth + 0.45, '#918e83');
    if (kind === 'house')
      roofs.push({
        position: [x, height + 1.6, z],
        scale: [width / Math.SQRT2 + 1.1, 3.2, depth / Math.SQRT2 + 1.1],
        color: roofColors[Math.floor(random() * roofColors.length)]!,
        rotation: Math.PI / 4,
      });
    else {
      box(x, height + 0.2, z, width + 1, 0.45, depth + 1, '#d9d6c9');
      box(x, height + 0.5, z, width - 1, 0.2, depth - 1, '#92958c');
      if (random() < 0.7)
        box(x + width * 0.18, height + 1.3, z + depth * 0.1, 3.3, 1.5, 3, '#b9b9aa');
    }
    const rows = Math.min(kind === 'house' ? 2 : 7, Math.max(1, Math.floor(height / 3.5)));
    for (const face of [0, 1, 2, 3]) {
      const span = face < 2 ? width : depth;
      const columns = Math.min(kind === 'house' ? 2 : 4, Math.max(1, Math.floor(span / 5)));
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
          const along = (col - (columns - 1) / 2) * (span / (columns + 1));
          const y = 2.2 + row * ((height - 2.8) / Math.max(1, rows));
          const position: [number, number, number] =
            face < 2
              ? [x + along, y, z + (face === 0 ? 1 : -1) * (depth / 2 + 0.04)]
              : [x + (face === 2 ? 1 : -1) * (width / 2 + 0.04), y, z + along];
          windows.push({
            position,
            scale: [
              kind === 'office' ? Math.min(3.2, span / (columns + 1) - 0.6) : 1.65,
              kind === 'office' ? 1.9 : 1.5,
              1,
            ],
            color: random() < 0.12 ? '#d9cf9f' : random() < 0.55 ? '#566b72' : '#748b91',
            rotation:
              face === 0 ? 0 : face === 1 ? Math.PI : face === 2 ? Math.PI / 2 : -Math.PI / 2,
          });
        }
    }
    box(x, 1.35, z + depth / 2 + 0.08, 1.6, 2.7, 0.15, '#485851');
    if (kind === 'apartment')
      for (let floor = 1; floor <= Math.min(4, Math.floor(height / 4)); floor++)
        box(x, floor * 3.5, z + depth / 2 + 0.7, width * 0.7, 0.22, 1.8, '#d6d0bf');
  };
  for (let ix = 0; ix < xs.length - 1; ix++)
    for (let iz = 0; iz < zs.length - 1; iz++) {
      const left = xs[ix]!,
        right = xs[ix + 1]!,
        north = zs[iz]!,
        south = zs[iz + 1]!;
      const usableX = right - left - 24,
        usableZ = south - north - 24;
      if (usableX < 18 || usableZ < 18) continue;
      const nx = usableX > 75 ? 3 : usableX > 38 ? 2 : 1,
        nz = usableZ > 75 ? 3 : usableZ > 38 ? 2 : 1;
      const cw = usableX / nx,
        cd = usableZ / nz;
      for (let cx = 0; cx < nx; cx++)
        for (let cz = 0; cz < nz; cz++) {
          if (nx === 3 && nz === 3 && cx === 1 && cz === 1) continue;
          const x = left + 12 + (cx + 0.5) * cw + (random() - 0.5) * 2,
            z = north + 12 + (cz + 0.5) * cd + (random() - 0.5) * 2;
          const width = cw * (0.7 + random() * 0.17),
            depth = cd * (0.68 + random() * 0.18);
          if (!fits(x, z, width, depth)) continue;
          const roll = random(),
            kind: CityBuilding['kind'] =
              roll < 0.42 ? 'house' : roll < 0.9 ? 'apartment' : 'office';
          const height =
            kind === 'house'
              ? 4.6 + random() * 4.5
              : kind === 'office'
                ? 28 + random() * 29
                : 10 + random() * 20;
          addBuilding(x, z, width, depth, height, kind);
        }
    }
  const tree = (x: number, z: number, size: number) => {
    // Plantings follow sidewalks, small gardens and patios, never a stadium-sized circle.
    if (
      (Math.abs(x) < 96 && z > -120 && z < 121) ||
      (x > 104 && x < 285 && z > -108 && z < 105) ||
      onRoad(x, z, 0.6)
    )
      return;
    if (
      buildings.some(
        (b) => Math.abs(x - b.x) < b.width / 2 + 2.8 && Math.abs(z - b.z) < b.depth / 2 + 2.8,
      )
    )
      return;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) return;
    trees.push({ x, z, size });
    const h = 3 + size * 0.8;
    trunks.push({
      position: [x, h / 2, z],
      scale: [0.3 + size * 0.08, h, 0.3 + size * 0.08],
      color: '#7d7057',
    });
    const green = ['#57734c', '#6c8653', '#4b7455', '#7b8e5b'][Math.floor(random() * 4)]!;
    canopies.push({
      position: [x, h + size * 0.45, z],
      scale: [size, size * 1.12, size * 0.92],
      color: green,
    });
    canopies.push({
      position: [x + size * 0.45, h + size * 0.9, z - size * 0.2],
      scale: [size * 0.72, size * 0.82, size * 0.7],
      color: green,
    });
  };
  for (const r of roads)
    for (let t = r.from + 11; t < r.to - 8; t += 17 + random() * 7) {
      if (junction(r, t) || random() < 0.24) continue;
      for (const side of [-1, 1])
        if (random() > 0.2) {
          const offset = side * (r.width / 2 + 3.4 + random() * 0.7);
          tree(
            r.axis === 'x' ? t : r.cross + offset,
            r.axis === 'x' ? r.cross + offset : t,
            2 + random() * 1.25,
          );
        }
    }
  for (let ix = 0; ix < xs.length - 1; ix++)
    for (let iz = 0; iz < zs.length - 1; iz++) {
      const x = (xs[ix]! + xs[ix + 1]!) / 2,
        z = (zs[iz]! + zs[iz + 1]!) / 2;
      if (cityReserved(x, z, 12) || onRoad(x, z, 4)) continue;
      box(x, 0.015, z, 13, 0.035, 15, '#93a27b');
      tree(x - 3.2, z + 1.8, 2.6);
      tree(x + 3.7, z - 3.4, 2.2);
      box(x + 3, 0.6, z + 4, 3.4, 0.6, 1, '#9b805d');
    }
  for (const [x, z] of [
    [-129, -106],
    [-139, 92],
    [-102, 135],
    [-25, 133],
    [27, 132],
    [75, 127],
    [-73, -125],
    [57, -125],
  ])
    tree(x!, z!, 2.8);
  const carColors = ['#b8c1be', '#e3dfd1', '#5b747b', '#a45f54', '#6f7366', '#c1ad7f'];
  for (const r of roads)
    for (let t = r.from + 17; t < r.to - 10; t += 31 + random() * 22) {
      if (junction(r, t) || random() < 0.28) continue;
      const lane = (random() < 0.5 ? -1 : 1) * r.width * 0.24;
      const x = r.axis === 'x' ? t : r.cross + lane,
        z = r.axis === 'x' ? r.cross + lane : t,
        rotation = r.axis === 'x' ? Math.PI / 2 : 0;
      box(
        x,
        0.78,
        z,
        1.9,
        1.35,
        4.4,
        carColors[Math.floor(random() * carColors.length)]!,
        rotation,
      );
      box(x, 1.65, z - 0.1, 1.65, 0.7, 2.25, '#6d878c', rotation);
    }
  return { roads, buildings, trees, boxes, windows, roofs, trunks, canopies };
}
