import type { OrbitControls } from 'three-stdlib';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Vector3,
} from 'three';
import {
  MATCH_DURATION_MS,
  matchKits,
  portraitAppearance,
  illustratedAppearance,
  type ClubKit,
  type MatchResult,
  type WorldState,
} from '@football/shared';

import { buildPlayback, samplePlayback } from './match-playback';

export function MatchActors({
  result,
  state,
  elapsed,
  followCamera = true,
}: {
  result: MatchResult;
  state: WorldState;
  elapsed: number;
  followCamera?: boolean;
}) {
  const minute = Math.min(90, (elapsed / MATCH_DURATION_MS) * 90);
  const home = state.clubs.byId[result.homeId ?? ''];
  const away = state.clubs.byId[result.awayId ?? ''];
  const kits = matchKits(home, away);
  const timeline = useMemo(() => {
    const ids = Object.keys(result.ratings ?? {});
    return buildPlayback(
      result.actions ?? [],
      result.lineups?.home ?? ids.filter((id) => state.players.byId[id]?.clubId === home?.id),
      result.lineups?.away ?? ids.filter((id) => state.players.byId[id]?.clubId === away?.id),
      ids.filter((id) => state.players.byId[id]?.position === 'GK'),
    );
  }, [result, state.players, home?.id, away?.id]);
  const view = samplePlayback(timeline, minute);
  const wall = (view.frame?.action.wallIds ?? []).flatMap((id) =>
    view.positions[id] ? [view.positions[id]!] : [],
  );
  const firstWall = wall[0],
    lastWall = wall.at(-1);
  return (
    <group>
      <MatchCamera
        enabled={followCamera}
        minute={minute}
        ball={view.ball}
        close={Boolean(
          view.frame &&
          ['shot', 'save', 'corner', 'free-kick', 'cross', 'penalty'].includes(
            view.frame.action.type,
          ),
        )}
        ended={elapsed >= MATCH_DURATION_MS}
      />
      {Object.entries(view.positions).map(([id, point]) => {
        if (view.frame?.dismissed.includes(id)) return null;
        const side =
          (result.lineups?.home.includes(id) ?? state.players.byId[id]?.clubId === home?.id)
            ? 'home'
            : 'away';
        const club = side === 'home' ? home : away;
        const slot = Object.keys(result.ratings ?? {})
          .filter((key) => state.players.byId[key]?.clubId === club?.id)
          .indexOf(id);
        return (
          <Runner
            key={id}
            x={point.x}
            z={point.z}
            kit={kits[side]}
            appearance={
              state.players.byId[id]
                ? portraitAppearance(state.players.byId[id]!)
                : illustratedAppearance(id)
            }
            side={side}
            slot={state.players.byId[id]?.position === 'GK' ? 0 : slot + 1}
            stopped={elapsed >= MATCH_DURATION_MS}
            moving={Boolean(
              view.frame &&
              view.progress < 0.8 &&
              Math.hypot(
                (view.frame.to[id]?.x ?? point.x) - (view.frame.from[id]?.x ?? point.x),
                (view.frame.to[id]?.z ?? point.z) - (view.frame.from[id]?.z ?? point.z),
              ) > 0.1,
            )}
            dive={
              view.frame?.action.keeperId === id
                ? (view.frame.action.keeperDive === 'left'
                    ? -1
                    : view.frame.action.keeperDive === 'center'
                      ? 0.35
                      : 1) *
                  (view.frame.action.type === 'shot'
                    ? Math.max(0, Math.min(1, (view.progress - 0.1) / 0.65))
                    : view.frame.action.type === 'save'
                      ? 1 - view.progress
                      : 0)
                : 0
            }
            jump={
              view.frame?.action.header && view.frame.action.playerId === id
                ? Math.sin(view.progress * Math.PI) * 0.9
                : view.frame?.action.type === 'shot' && view.frame.action.wallIds?.includes(id)
                  ? Math.sin(Math.max(0, Math.min(1, (view.progress - 0.1) / 0.7)) * Math.PI) * 0.55
                  : 0
            }
            facing={
              view.frame
                ? Math.atan2(
                    view.frame.ballTo.x - view.frame.ballFrom.x,
                    view.frame.ballTo.z - view.frame.ballFrom.z,
                  )
                : 0
            }
            kicking={
              view.frame?.action.playerId === id &&
              ['pass', 'cross', 'shot'].includes(view.frame.action.type) &&
              !view.frame.action.header &&
              view.progress > 0.08 &&
              view.progress < 0.3
            }
          />
        );
      })}
      {firstWall && lastWall && (
        <mesh
          position={[(firstWall.x + lastWall.x) / 2, 0.07, (firstWall.z + lastWall.z) / 2]}
          rotation={[0, -Math.atan2(lastWall.z - firstWall.z, lastWall.x - firstWall.x), 0]}
        >
          <boxGeometry
            args={[Math.hypot(lastWall.x - firstWall.x, lastWall.z - firstWall.z) + 1, 0.05, 0.2]}
          />
          <meshBasicMaterial color="#ffe080" />
        </mesh>
      )}
      <mesh position={[view.ball.x, view.height, view.ball.z]} castShadow>
        <sphereGeometry args={[0.45, 12, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {elapsed >= MATCH_DURATION_MS &&
        elapsed < MATCH_DURATION_MS + 6000 &&
        result.homeGoals > result.awayGoals && <Fireworks />}
    </group>
  );
}

function MatchCamera({
  enabled,
  minute,
  ball,
  close,
  ended,
}: {
  enabled: boolean;
  minute: number;
  ball: { x: number; z: number };
  close: boolean;
  ended: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControls | undefined;
  const target = useMemo(() => new Vector3(), []),
    position = useMemo(() => new Vector3(), []);
  const previous = useRef<number | null>(null);
  const interacting = useRef(false);
  const resumeAt = useRef(0);
  useEffect(() => {
    if (!controls) return;
    const start = () => {
      interacting.current = true;
      camera.position.sub(controls.target);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    const end = () => {
      interacting.current = false;
      resumeAt.current = performance.now() + 3000;
    };
    controls.addEventListener('start', start);
    controls.addEventListener('end', end);
    return () => {
      controls.removeEventListener('start', start);
      controls.removeEventListener('end', end);
    };
  }, [camera, controls, enabled]);
  useFrame((_, delta) => {
    if (!controls) return;
    if (interacting.current || performance.now() < resumeAt.current) {
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }
    if (!enabled) return;
    target.set(
      ended ? 0 : Math.max(-25, Math.min(25, ball.x)),
      0,
      ended ? 0 : Math.max(-42, Math.min(42, ball.z)),
    );
    position.copy(target).add(ended ? new Vector3(95, 120, 110) : new Vector3(30, 75, 24));
    const seek = previous.current === null || Math.abs(minute - previous.current) > 2;
    const blend = seek ? 1 : 1 - Math.exp(-delta * (close ? 4 : 2.5));
    controls.target.lerp(target, blend);
    camera.position.lerp(position, blend);
    controls.update();
    previous.current = minute;
  });
  return null;
}

function Runner({
  x,
  z,
  kit,
  appearance,
  side,
  slot,
  stopped,
  kicking,
  moving,
  facing,
  dive,
  jump,
}: {
  x: number;
  z: number;
  kit: ClubKit;
  appearance: ReturnType<typeof illustratedAppearance>;
  side: 'home' | 'away';
  slot: number;
  stopped: boolean;
  kicking: boolean;
  moving: boolean;
  facing: number;
  dive: number;
  jump: number;
}) {
  const group = useRef<Group>(null);
  const leg = useRef<Mesh>(null);
  const body = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const distance = Math.hypot(x - group.current.position.x, z - group.current.position.z);
    group.current.position.set(x, Math.abs(dive) * 0.85 + jump, z);
    if (body.current) body.current.rotation.z = -dive * (side === 'home' ? 1 : -1) * 1.2;
    if (distance > 0.02)
      group.current.rotation.y = Math.atan2(
        x - (group.current.userData.lastX ?? x),
        z - (group.current.userData.lastZ ?? z),
      );
    group.current.userData.lastX = x;
    group.current.userData.lastZ = z;
    if (Math.abs(dive) > 0.01) group.current.rotation.y = side === 'home' ? 0 : Math.PI;
    if (kicking) group.current.rotation.y = facing;
    if (leg.current)
      leg.current.rotation.x = kicking
        ? -1.1
        : stopped || !moving
          ? 0
          : Math.sin(clock.elapsedTime * 7 + slot) * 0.35;
  });
  const primary = kit.primary;
  const secondary = kit.secondary;
  const pattern = slot === 0 ? 'solid' : kit.pattern;
  const jersey = slot === 0 ? (kit.tertiary ?? secondary) : primary;
  return (
    <group ref={group} rotation={[0, side === 'home' ? 0 : Math.PI, 0]}>
      <group ref={body} position={[0, 1.05, 0]} scale={0.7}>
        <group position={[0, -1.5, 0]}>
          <mesh position={[0, 2.9, 0]} castShadow>
            <sphereGeometry args={[0.45, 8, 6]} />
            <meshStandardMaterial color={appearance.skinTone} />
          </mesh>
          {appearance.hairStyle !== 'bald' && (
            <mesh position={[0, 2.96, 0]}>
              <sphereGeometry args={[0.46, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={appearance.hairColor} />
            </mesh>
          )}
          {appearance.beardStyle !== 'none' && (
            <mesh position={[0, 2.69, 0.27]}>
              <boxGeometry args={[0.5, 0.15, 0.18]} />
              <meshStandardMaterial color={appearance.hairColor} />
            </mesh>
          )}
          <mesh position={[0, 1.9, 0]} castShadow>
            <boxGeometry args={[1.2, 1.3, 0.65]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
          {pattern === 'sash' &&
            [-1, 1].map((face) => (
              <mesh key={face} position={[0, 1.9, face * 0.345]} rotation={[0, 0, face * -0.65]}>
                <boxGeometry args={[1.3, 0.18, 0.025]} />
                <meshStandardMaterial color={secondary} />
              </mesh>
            ))}
          {['stripes', 'hoops'].includes(pattern) &&
            [-0.35, 0, 0.35].map((offset, index) => (
              <mesh
                key={index}
                position={[
                  pattern === 'stripes' ? offset : 0,
                  pattern === 'hoops' ? 1.9 + offset : 1.9,
                  0,
                ]}
              >
                <boxGeometry
                  args={pattern === 'stripes' ? [0.16, 1.3, 0.675] : [1.215, 0.16, 0.675]}
                />
                <meshStandardMaterial
                  color={kit.tertiary && index === 1 ? kit.tertiary : secondary}
                />
              </mesh>
            ))}
          {[-1, 1].map((arm) => (
            <mesh
              key={arm}
              position={[arm * 0.82, 1.9, 0]}
              rotation={[0, 0, arm * (Math.abs(dive) > 0.1 ? 0.8 : 0.15)]}
            >
              <boxGeometry args={[0.28, 1, 0.35]} />
              <meshStandardMaterial color={jersey} />
            </mesh>
          ))}
          <mesh ref={leg} position={[-0.32, 0.65, 0]}>
            <boxGeometry args={[0.35, 1.2, 0.4]} />
            <meshStandardMaterial color={secondary} />
          </mesh>
          <mesh position={[0.32, 0.65, 0]}>
            <boxGeometry args={[0.35, 1.2, 0.4]} />
            <meshStandardMaterial color={secondary} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
function Fireworks() {
  const fireworks = useMemo(() => {
    const rays = 56;
    const trail = 8;
    const positions = new Float32Array(12 * rays * trail * 6);
    const colors = new Float32Array(positions.length);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return { geometry, positions, colors, rays, trail };
  }, []);
  useEffect(() => () => fireworks.geometry.dispose(), [fireworks]);
  useFrame(({ clock }) => {
    const { positions, colors, rays, trail, geometry } = fireworks;
    const palette = ['#ffd36b', '#ff8645', '#ff68b4', '#fff1ce'];
    const color = new Color();
    let offset = 0;
    for (let burst = 0; burst < 12; burst++) {
      const age = (clock.elapsedTime + burst * 0.61) % 4.8;
      const side = burst < 6 ? -1 : 1;
      const originX = side * 65;
      const originZ = -65 + (burst % 6) * 26;
      const height = 42 + (burst % 3) * 9;
      color.set(palette[burst % palette.length]!);
      for (let ray = 0; ray < rays; ray++) {
        const vertical = 1 - (2 * (ray + 0.5)) / rays;
        const radial = Math.sqrt(1 - vertical * vertical);
        const angle = ray * 2.39996 + burst;
        const speed = 12 + ((ray * 17 + burst * 7) % 13);
        for (let segment = 0; segment < trail; segment++) {
          for (let endpoint = 0; endpoint < 2; endpoint++) {
            const t = Math.max(0, age - 1 - (segment + endpoint) * 0.035);
            const travel = (1 - Math.exp(-t * 0.65)) / 0.65;
            const launching = age < 1;
            positions[offset] =
              originX + (launching ? 0 : Math.cos(angle) * radial * speed * travel);
            positions[offset + 1] = launching
              ? 5 + Math.max(0, age - (segment + endpoint) * 0.015) * (height - 5)
              : height + vertical * speed * travel - 4.8 * t * t;
            positions[offset + 2] =
              originZ + (launching ? 0 : Math.sin(angle) * radial * speed * travel);
            const fade = launching
              ? ray === 0
                ? 1 - segment / trail
                : 0
              : Math.max(0, 1 - t / 2.9) *
                (1 - segment / trail) *
                (0.75 + 0.25 * Math.sin(ray * 13 + age * 24));
            colors[offset] = color.r * fade;
            colors[offset + 1] = color.g * fade;
            colors[offset + 2] = color.b * fade;
            offset += 3;
          }
        }
      }
    }
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.color!.needsUpdate = true;
  });
  return (
    <lineSegments geometry={fireworks.geometry} frustumCulled={false}>
      <lineBasicMaterial
        vertexColors
        blending={AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
