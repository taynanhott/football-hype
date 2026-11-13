import { presentationGameMinute } from './match-presentation';
/* eslint-disable react-hooks/immutability -- Three.js animation buffers are updated in place each frame. */
import type { OrbitControls } from 'three-stdlib';
import { runnerMotion } from './runner-motion';
import { PlayerFigure } from './player-figure';
import { playerBuild } from './player-build';
import { bootGroundLift, PITCH_SURFACE_Y } from './pitch-surface';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
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

import { buildPlayback, samplePlayback, playbackBallHeight } from './match-playback';
import { MatchAtmosphere, MatchReferee } from './match-atmosphere';

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
  const minute = presentationGameMinute(
    result.actions ?? [],
    Math.min(90, (elapsed / MATCH_DURATION_MS) * 90),
  );
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
      result.substitutions,
    );
  }, [result, state.players, home?.id, away?.id]);
  const view = samplePlayback(timeline, minute);
  const renderedView = useRef(view);
  const sceneClock = useThree((state) => state.clock);
  const anchor = useRef({ elapsed, at: 0 });
  useLayoutEffect(() => {
    anchor.current = { elapsed, at: sceneClock.elapsedTime };
  }, [elapsed, sceneClock]);
  // Update scene objects each frame without re-rendering the React interface.
  useFrame(({ clock }) => {
    const time = anchor.current.elapsed + (clock.elapsedTime - anchor.current.at) * 1000;
    renderedView.current = samplePlayback(
      timeline,
      presentationGameMinute(result.actions ?? [], Math.min(90, (time / MATCH_DURATION_MS) * 90)),
    );
  });
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
          result.lineups?.home.includes(id) ||
          result.substitutions?.some((s) => s.in === id && s.side === 'home') ||
          state.players.byId[id]?.clubId === home?.id
            ? 'home'
            : 'away';
        const club = side === 'home' ? home : away;
        const slot = Object.keys(result.ratings ?? {})
          .filter((key) => state.players.byId[key]?.clubId === club?.id)
          .indexOf(id);
        return (
          <Runner
            key={id}
            playerId={id}
            renderedView={renderedView}
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
      <PlaybackBall renderedView={renderedView} />
      <MatchReferee renderedView={renderedView} ended={elapsed >= MATCH_DURATION_MS} />
      {elapsed < MATCH_DURATION_MS && <MatchAtmosphere renderedView={renderedView} />}
      {elapsed >= MATCH_DURATION_MS &&
        elapsed < MATCH_DURATION_MS + 6000 &&
        result.homeGoals > result.awayGoals && (
          <Fireworks color={state.stadiums.byId[home?.stadiumId ?? '']?.color ?? '#ffd36b'} />
        )}
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
  playerId,
  renderedView,
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
  jump,
}: {
  playerId: string;
  renderedView: RefObject<ReturnType<typeof samplePlayback>>;
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
  const build = useMemo(() => playerBuild(playerId), [playerId]);
  const group = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null);
  const rightKnee = useRef<Group>(null);
  const leftBoot = useRef<Mesh>(null);
  const rightBoot = useRef<Mesh>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const armTarget = useMemo(() => new Vector3(), []);
  const armDown = useMemo(() => new Vector3(0, -1, 0), []);
  const stride = useRef(slot);
  const body = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const point = renderedView.current.positions[playerId];
    const nextX = point?.x ?? x;
    const nextZ = point?.z ?? z;
    const distance = Math.hypot(nextX - group.current.position.x, nextZ - group.current.position.z);
    const playback = renderedView.current;
    const action = playback.frame?.action;
    const sliding = action?.type === 'foul' && action.playerId === playerId;
    const falling = action?.type === 'foul' && action.victimId === playerId;
    const contact = Math.sin((Math.min(1, playback.progress / 0.65) * Math.PI) / 2);
    const keeperAction = action?.keeperId === playerId && ['shot', 'save'].includes(action.type);
    const reach = keeperAction
      ? action.type === 'shot'
        ? Math.sin((Math.max(0, Math.min(1, (playback.progress - 0.18) / 0.78)) * Math.PI) / 2)
        : Math.max(0, 1 - playback.progress * 1.35)
      : 0;
    const keeperDive =
      reach * (action?.keeperDive === 'left' ? -1 : action?.keeperDive === 'center' ? 0.15 : 1);
    const jumpLift =
      action?.header && action.playerId === playerId
        ? Math.sin(playback.progress * Math.PI) * 0.9
        : action?.type === 'shot' && action.wallIds?.includes(playerId)
          ? Math.sin(Math.max(0, Math.min(1, (playback.progress - 0.1) / 0.7)) * Math.PI) * 0.55
          : jump;
    group.current.position.set(
      keeperAction
        ? nextX +
            ((action.type === 'shot' ? (action.endX ?? nextX) : action.x) -
              nextX -
              (action.keeperDive === 'left' ? -0.7 : 0.7)) *
              reach
        : nextX,
      PITCH_SURFACE_Y + jumpLift + Math.sin(reach * Math.PI) * 0.45,
      nextZ,
    );
    const takingKick =
      action?.playerId === playerId &&
      ['pass', 'cross', 'shot'].includes(action.type) &&
      !action.header;
    const running = stopped ? 0 : Math.min(1, distance / Math.max(0.001, delta) / 8);
    if (distance < 2) stride.current += distance * 2.6;
    const motion = runnerMotion(
      stride.current,
      moving || running > 0.05 ? running : 0,
      takingKick && !stopped
        ? { progress: playback.progress, shot: action?.type === 'shot' }
        : undefined,
    );
    if (body.current) {
      body.current.rotation.z = -keeperDive * (side === 'home' ? 1 : -1) * 1.3;
      body.current.rotation.x = sliding ? -contact * 1.2 : falling ? contact * 1.25 : motion.lean;
      body.current.position.y =
        1.05 * build.height +
        motion.bounce -
        Math.abs(keeperDive) * 0.5 -
        (sliding || falling ? contact * 0.65 : 0);
    }
    if (distance > 0.02)
      group.current.rotation.y = Math.atan2(
        nextX - (group.current.userData.lastX ?? nextX),
        nextZ - (group.current.userData.lastZ ?? nextZ),
      );
    group.current.userData.lastX = nextX;
    group.current.userData.lastZ = nextZ;
    if (takingKick || kicking)
      group.current.rotation.y = action
        ? Math.atan2((action.endX ?? action.x) - action.x, (action.endZ ?? action.z) - action.z)
        : facing;
    // A keeper shuffles toward the line while still facing the ball, including penalty setup.
    if (slot === 0 && !takingKick && !kicking) {
      const target =
        action?.type === 'penalty' || action?.type === 'shot'
          ? { x: action.x, z: action.z }
          : action?.type === 'save'
            ? { x: nextX, z: 0 }
            : playback.ball;
      const dx = target.x - group.current.position.x;
      const dz = target.z - nextZ;
      group.current.rotation.y =
        Math.hypot(dx, dz) > 0.1 ? Math.atan2(dx, dz) : side === 'home' ? 0 : Math.PI;
    }
    if (leftLeg.current) leftLeg.current.rotation.x = motion.leftLeg;
    if (rightLeg.current) rightLeg.current.rotation.x = motion.rightLeg;
    if (leftKnee.current) leftKnee.current.rotation.x = motion.leftKnee;
    if (rightKnee.current) rightKnee.current.rotation.x = motion.rightKnee;
    if (leftArm.current) leftArm.current.rotation.x = motion.leftArm;
    if (rightArm.current) rightArm.current.rotation.x = motion.rightArm;
    for (const [arm, sign] of [
      [leftArm.current, -1],
      [rightArm.current, 1],
    ] as const)
      if (arm) {
        arm.rotation.z = sign * (0.15 + reach * 1.35);
        if (keeperAction) arm.rotation.x = -reach * 0.8;
      }
    if (sliding) {
      if (leftLeg.current) leftLeg.current.rotation.x = -1.15 * contact;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.5 * contact;
      if (rightKnee.current) rightKnee.current.rotation.x = 1.5 * contact;
    }
    if (keeperAction) {
      const sign = action.keeperDive === 'left' ? -1 : 1;
      for (const arm of [leftArm.current, rightArm.current]) {
        if (!arm) continue;
        arm.rotation.z = -sign * reach * 2.1;
        arm.rotation.x = -reach * 0.7;
      }
    }
    // Only raise a penetrating sole; preserve the existing jump and dive trajectory.
    let groundLift = 0;
    for (const boot of [leftBoot.current, rightBoot.current]) {
      if (!boot) continue;
      boot.updateWorldMatrix(true, false);
      groundLift = Math.max(groundLift, bootGroundLift(boot.matrixWorld));
    }
    group.current.position.y += groundLift;
    if (keeperAction && reach > 0.05) {
      group.current.updateWorldMatrix(true, true);
      for (const arm of [leftArm.current, rightArm.current]) {
        if (!arm?.parent) continue;
        armTarget.set(
          action.type === 'shot' ? (action.endX ?? action.x) : action.x,
          playbackBallHeight(
            action.type === 'shot' ? (action.endHeight ?? 1.5) : (action.startHeight ?? 1.5),
          ),
          action.type === 'shot' ? (action.endZ ?? action.z) : action.z,
        );
        arm.parent.worldToLocal(armTarget);
        armTarget.sub(arm.position).normalize();
        arm.quaternion.setFromUnitVectors(armDown, armTarget);
      }
    }
  });
  return (
    <group
      ref={group}
      position={[x, PITCH_SURFACE_Y, z]}
      rotation={[0, side === 'home' ? 0 : Math.PI, 0]}
    >
      <group
        ref={body}
        position={[0, 1.05 * build.height, 0]}
        scale={[0.7 * build.width, 0.7 * build.height, 0.7]}
      >
        <PlayerFigure
          kit={kit}
          appearance={appearance}
          build={build}
          keeper={slot === 0}
          leftArm={leftArm}
          rightArm={rightArm}
          leftLeg={leftLeg}
          rightLeg={rightLeg}
          leftKnee={leftKnee}
          rightKnee={rightKnee}
          leftBoot={leftBoot}
          rightBoot={rightBoot}
        />
      </group>
    </group>
  );
}

function Fireworks({ color: victoryColor }: { color: string }) {
  const compact = useThree((s) => s.size.width < 900);
  const fireworks = useMemo(() => {
    const rays = compact ? 16 : 56;
    const trail = compact ? 3 : 8;
    const positions = new Float32Array(12 * rays * trail * 6);
    const colors = new Float32Array(positions.length);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return { geometry, positions, colors, rays, trail };
  }, [compact]);
  useEffect(() => () => fireworks.geometry.dispose(), [fireworks]);
  useFrame(({ clock }) => {
    const { positions, colors, rays, trail, geometry } = fireworks;
    const palette = [victoryColor, victoryColor, '#ffffff', victoryColor];
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

function PlaybackBall({
  renderedView,
}: {
  renderedView: RefObject<ReturnType<typeof samplePlayback>>;
}) {
  const radius = 0.143;
  const ball = useRef<Mesh>(null);
  useFrame(() => {
    const view = renderedView.current;
    // Playback heights use the former radius as their ground baseline.
    ball.current?.position.set(view.ball.x, playbackBallHeight(view.height, radius), view.ball.z);
  });
  return (
    <mesh ref={ball} castShadow>
      <sphereGeometry args={[radius, 12, 8]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
}
