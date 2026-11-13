/* eslint-disable react-hooks/set-state-in-effect -- Occupied poses require clearance from the mounted stadium geometry. */
/* eslint-disable react-hooks/immutability -- Instance matrices and animation uniforms are GPU buffers. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowdNoise, occupiedCrowdSeats, type CrowdSeat } from './stadium-seating';
import { clearCrowdSeats, crowdBoxClearance } from './crowd-clearance';
import { visitorCrowdSeat } from './flare-layout';

type Kit = { primary: string; secondary: string };
type Pose = 'rest' | 'cheer' | 'flare';
const poses: Pose[] = ['rest', 'cheer', 'flare'];
const crowdSeatKey = (s: CrowdSeat) => [s.x, s.y, s.z].join(':');
function figure(pose: Pose) {
  const parts: SphereGeometry[] = [];
  const part = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    kind: number,
    color = '#ffffff',
    angle = 0,
  ) => {
    const g = new SphereGeometry(1, 6, 4);
    const object = new Object3D();
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    object.rotation.z = angle;
    object.updateMatrix();
    g.applyMatrix4(object.matrix);
    const n = g.getAttribute('position').count,
      colors = new Float32Array(n * 3),
      kinds = new Float32Array(n);
    const tint = new Color(color);
    for (let i = 0; i < n; i++) {
      colors.set([tint.r, tint.g, tint.b], i * 3);
      kinds[i] = kind;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.setAttribute('tintKind', new BufferAttribute(kinds, 1));
    parts.push(g);
  };
  part(0, 0.87, 0, 0.23, 0.31, 0.14, 1); // Rounded shirt and shoulders.
  part(0, 0.57, 0, 0.21, 0.13, 0.14, 0, '#26303c');
  part(0, 1.14, 0, 0.07, 0.1, 0.07, 2);
  part(0, 1.29, 0.015, 0.14, 0.175, 0.135, 2);
  part(0, 1.4, -0.025, 0.143, 0.085, 0.13, 0, pose === 'cheer' ? '#533b2d' : '#25201e');
  part(0, 1.29, 0.145, 0.035, 0.04, 0.045, 2); // Face points toward the pitch.
  for (const side of [-1, 1]) {
    part(side * 0.105, 0.31, 0, 0.08, 0.25, 0.08, 0, '#344154');
    part(side * 0.105, 0.065, 0.045, 0.09, 0.065, 0.14, 0, '#20272b');
    const raised = pose === 'cheer' || (pose === 'flare' && side === 1);
    const shoulder = [side * 0.22, 1.02, 0],
      elbow = raised ? [side * 0.35, 1.32, 0.035] : [side * 0.29, 0.81, 0.015];
    const hand = raised ? [side * 0.32, 1.72, 0.08] : [side * 0.27, 0.62, 0.08];
    const limb = (a: number[], b: number[], r: number, kind: number) => {
      const dx = b[0]! - a[0]!,
        dy = b[1]! - a[1]!;
      part(
        (a[0]! + b[0]!) / 2,
        (a[1]! + b[1]!) / 2,
        (a[2]! + b[2]!) / 2,
        r,
        Math.hypot(dx, dy) / 2 + r * 0.3,
        r,
        kind,
        '#ffffff',
        -Math.atan2(dx, dy),
      );
    };
    limb(shoulder, elbow, 0.075, 1);
    limb(elbow, hand, 0.055, 2);
    part(hand[0]!, hand[1]!, hand[2]!, 0.065, 0.075, 0.06, 2);
  }
  if (pose === 'flare') part(0.32, 1.85, 0.08, 0.035, 0.15, 0.035, 0, '#e3d9c5');
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return merged;
}
function PeopleBatch({
  pose,
  seats,
  holders,
  homeKit,
  awayKit,
}: {
  pose: Pose;
  seats: readonly CrowdSeat[];
  holders: ReadonlySet<string>;
  homeKit: Kit;
  awayKit: Kit;
}) {
  const homePrimary = homeKit.primary,
    homeSecondary = homeKit.secondary;
  const awayPrimary = awayKit.primary,
    awaySecondary = awayKit.secondary;
  const ref = useRef<InstancedMesh>(null),
    time = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(() => figure(pose), [pose]);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 0.95, vertexColors: true });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.crowdTime = time;
      shader.vertexShader =
        'attribute float tintKind; attribute vec3 shirtTint; attribute vec3 skinTint; attribute vec3 crowdMotion; uniform float crowdTime;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        '#include <color_vertex>\n vColor.xyz *= tintKind > 1.5 ? skinTint : (tintKind > 0.5 ? shirtTint : vec3(1.0));',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.y += pow(max(0.0,sin(crowdTime*crowdMotion.y+crowdMotion.x)),2.0)*crowdMotion.z;',
      );
    };
    return m;
  }, [time]);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const root = scene.getObjectByName('stadium-structure'),
      clear = root ? crowdBoxClearance(root) : null;
    const shirt = new Float32Array(seats.length * 3),
      skin = new Float32Array(seats.length * 3),
      motion = new Float32Array(seats.length * 3);
    const dummy = new Object3D(),
      tint = new Color();
    seats.forEach((seat, i) => {
      const holder = holders.has(crowdSeatKey(seat)),
        height = holder
          ? 1
          : pose === 'rest' && clear && !clear(seat, 0.8, 1.55, 0.28)
            ? 0.83
            : 0.93 + crowdNoise(i + 53) * 0.12;
      dummy.position.set(seat.x, seat.y - 0.425, seat.z);
      dummy.rotation.set(0, seat.rotation, 0);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const visitor = visitorCrowdSeat(seat),
        variation = crowdNoise(i + 29);
      tint.set(
        variation < 0.12
          ? '#b6b8b1'
          : variation < 0.35
            ? visitor
              ? awaySecondary
              : homeSecondary
            : visitor
              ? awayPrimary
              : homePrimary,
      );
      shirt.set([tint.r, tint.g, tint.b], i * 3);
      tint.set(['#e2ac80', '#b77b51', '#754a36', '#f0c8a0'][Math.floor(crowdNoise(i + 97) * 4)]!);
      skin.set([tint.r, tint.g, tint.b], i * 3);
      motion.set(
        [
          crowdNoise(i + 911) * 31,
          3 + crowdNoise(i + 912) * 2,
          pose === 'cheer' && (!clear || clear(seat, 1.0, 2.2, 0.48)) ? 0.12 : 0,
        ],
        i * 3,
      );
    });
    geometry.setAttribute('shirtTint', new InstancedBufferAttribute(shirt, 3));
    geometry.setAttribute('skinTint', new InstancedBufferAttribute(skin, 3));
    geometry.setAttribute('crowdMotion', new InstancedBufferAttribute(motion, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [
    seats,
    holders,
    homePrimary,
    homeSecondary,
    awayPrimary,
    awaySecondary,
    geometry,
    pose,
    scene,
  ]);
  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <instancedMesh ref={ref} args={[geometry, material, seats.length]} />;
}
export function CrowdPeople({
  seats,
  occupancy,
  flares,
  homeKit,
  awayKit,
}: {
  seats: readonly CrowdSeat[];
  occupancy: number;
  flares: readonly CrowdSeat[];
  homeKit: Kit;
  awayKit: Kit;
}) {
  const scene = useThree((s) => s.scene);
  const [batches, setBatches] = useState<Record<Pose, CrowdSeat[]>>({
    rest: [],
    cheer: [],
    flare: [],
  });
  const holders = useMemo(() => new Set(flares.map(crowdSeatKey)), [flares]);
  useLayoutEffect(() => {
    const root = scene.getObjectByName('stadium-structure');
    if (!root) return;
    const safe = clearCrowdSeats(root, seats),
      occupied = occupiedCrowdSeats(safe, occupancy),
      clear = crowdBoxClearance(root);
    const next: Record<Pose, CrowdSeat[]> = { rest: [], cheer: [], flare: [] };
    safe.forEach((seat, i) => {
      if (!occupied[i]) return;
      const pose = holders.has(crowdSeatKey(seat))
        ? 'flare'
        : crowdNoise(i + 701) < 0.38 && clear(seat, 0.7, 2.0, 0.48)
          ? 'cheer'
          : 'rest';
      next[pose].push(seat);
    });
    setBatches(next);
  }, [scene, seats, occupancy, holders, setBatches]);
  return (
    <group name="Torcedores com poses variadas">
      {poses.map(
        (pose) =>
          batches[pose].length > 0 && (
            <PeopleBatch
              key={pose}
              pose={pose}
              seats={batches[pose]}
              holders={holders}
              homeKit={homeKit}
              awayKit={awayKit}
            />
          ),
      )}
    </group>
  );
}
