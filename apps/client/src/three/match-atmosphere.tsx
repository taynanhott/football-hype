import { illustratedAppearance, type ClubKit, type MatchResult } from '@football/shared';
import { PlayerFigure } from './player-figure';
import { playerBuild } from './player-build';
import { runnerMotion } from './runner-motion';
import { bootGroundLift, PITCH_SURFACE_Y } from './pitch-surface';
import { flareOrigins, flareEmitter, type FlareOrigin } from './flare-layout';
/* eslint-disable react-hooks/set-state-in-effect -- Rebuild flare anchors after the stadium geometry mounts. */
import { useState, useLayoutEffect, useMemo, useRef, useEffect, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  ShaderMaterial,
  NormalBlending,
} from 'three';
import type { samplePlayback } from './match-playback';
import type { CrowdSeat } from './stadium-seating';
import { crowdNoise, occupiedCrowdSeats } from './stadium-seating';
import { clearCrowdSeats, smokePlumeLimit } from './crowd-clearance';
type View = RefObject<ReturnType<typeof samplePlayback>>;

export function MatchReferee({
  renderedView,
  ended,
  card,
}: {
  renderedView: View;
  ended: boolean;
  card: NonNullable<MatchResult['actions']>[number] | undefined;
}) {
  const referee = useRef<Group>(null),
    arm = useRef<Group>(null);
  const leftArm = useRef<Group>(null),
    leftLeg = useRef<Group>(null),
    rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null),
    rightKnee = useRef<Group>(null);
  const leftBoot = useRef<Mesh>(null),
    rightBoot = useRef<Mesh>(null),
    body = useRef<Group>(null);
  const build = useMemo(() => playerBuild('match-referee'), []);
  const appearance = useMemo(() => illustratedAppearance('match-referee'), []);
  const kit: ClubKit = { primary: '#e5009a', secondary: '#17212a', pattern: 'solid' };
  const stride = useRef(0);
  useFrame((_, delta) => {
    if (!referee.current) return;
    const view = renderedView.current,
      ball = view.ball;
    const desiredX = Math.max(-27, Math.min(27, ball.x * 0.65 + (ball.x > 0 ? -7 : 7)));
    const desiredZ = Math.max(-40, Math.min(40, ball.z * 0.7 - 6));
    const dx = desiredX - referee.current.position.x,
      dz = desiredZ - referee.current.position.z,
      distance = Math.hypot(dx, dz);
    const step = Math.min(distance, delta * 7);
    const moving = distance > 0.4 && !card;
    if (moving) {
      referee.current.position.x += (dx / distance) * step;
      referee.current.position.z += (dz / distance) * step;
      stride.current += step * 2.4;
    }
    const offender = card ? (view.positions[card.playerId ?? ''] ?? card) : ball;
    referee.current.rotation.y = card
      ? Math.atan2(offender.x - referee.current.position.x, offender.z - referee.current.position.z)
      : moving
        ? Math.atan2(dx, dz)
        : Math.atan2(ball.x - referee.current.position.x, ball.z - referee.current.position.z);
    const motion = runnerMotion(stride.current, moving && !ended ? 0.8 : 0);
    if (leftLeg.current) leftLeg.current.rotation.x = motion.leftLeg;
    if (rightLeg.current) rightLeg.current.rotation.x = motion.rightLeg;
    if (leftKnee.current) leftKnee.current.rotation.x = motion.leftKnee;
    if (rightKnee.current) rightKnee.current.rotation.x = motion.rightKnee;
    if (leftArm.current) leftArm.current.rotation.x = motion.leftArm;
    if (body.current) {
      body.current.rotation.x = motion.lean;
      body.current.position.y = 1.05 * build.height + motion.bounce;
    }
    referee.current.position.y = PITCH_SURFACE_Y;
    const currentMinute = view.frame
      ? view.frame.minute + (view.frame.endMinute - view.frame.minute) * view.progress
      : 0;
    const whistling =
      ended ||
      (currentMinute >= 45 && currentMinute < 45.25) ||
      (view.frame?.action.outcome === 'goal' && view.progress > 0.84) ||
      (view.progress < 0.3 && ['foul', 'kickoff', 'goal'].includes(view.frame?.action.type ?? ''));
    if (arm.current)
      arm.current.rotation.x = card ? -Math.PI + 0.35 : whistling ? -1.8 : motion.rightArm;
    let lift = 0;
    for (const boot of [leftBoot.current, rightBoot.current]) {
      if (!boot) continue;
      boot.updateWorldMatrix(true, false);
      lift = Math.max(lift, bootGroundLift(boot.matrixWorld));
    }
    referee.current.position.y += lift;
  });
  return (
    <group ref={referee} position={[7, PITCH_SURFACE_Y, -6]} name="Árbitro de magenta">
      <group
        ref={body}
        position={[0, 1.05 * build.height, 0]}
        scale={[0.7 * build.width, 0.7 * build.height, 0.7]}
      >
        <PlayerFigure
          kit={kit}
          appearance={appearance}
          build={build}
          keeper={false}
          leftArm={leftArm}
          rightArm={arm}
          leftLeg={leftLeg}
          rightLeg={rightLeg}
          leftKnee={leftKnee}
          rightKnee={rightKnee}
          leftBoot={leftBoot}
          rightBoot={rightBoot}
          rightHand={
            card ? (
              <mesh name={card.type === 'red' ? 'Cartão vermelho' : 'Cartão amarelo'}>
                <boxGeometry args={[0.32, 0.46, 0.035]} />
                <meshBasicMaterial color={card.type === 'red' ? '#ff2525' : '#ffe500'} />
              </mesh>
            ) : null
          }
        />
      </group>
    </group>
  );
}

function ParticleField({
  origins,
  color,
  count,
  sparks = false,
  rise = 8,
  core = false,
  haze = false,
}: {
  origins: readonly (CrowdSeat & {
    color?: string;
    flow?: readonly [number, number, number];
    travel?: number;
  })[];
  color: string;
  count: number;
  sparks?: boolean;
  rise?: number;
  core?: boolean;
  haze?: boolean;
}) {
  const material = useRef<ShaderMaterial>(null);
  const pointScale = useThree((s) => s.size.height * s.gl.getPixelRatio() * 0.8);
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      positions = new Float32Array(count * 3),
      phases = new Float32Array(count),
      flows = new Float32Array(count * 3),
      tints = new Float32Array(count * 3),
      travels = new Float32Array(count);
    const tint = new Color();
    for (let i = 0; i < count; i++) {
      const origin = origins[i % origins.length];
      if (origin) positions.set([origin.x, origin.y + 1.35, origin.z], i * 3);
      phases[i] = crowdNoise(i + 31);
      travels[i] = origin?.travel ?? 1;
      flows.set(origin?.flow ?? [0, 1, 0], i * 3);
      tint.set(haze ? color : (origin?.color ?? color));
      tints.set([tint.r, tint.g, tint.b], i * 3);
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('phase', new Float32BufferAttribute(phases, 1));
    g.setAttribute('travelLimit', new Float32BufferAttribute(travels, 1));
    g.setAttribute('flow', new Float32BufferAttribute(flows, 3));
    g.setAttribute('tintAttribute', new Float32BufferAttribute(tints, 3));
    return g;
  }, [origins, count, color, haze]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      tint: { value: colorToRGB(color) },
      spark: { value: sparks ? 1 : 0 },
      rise: { value: rise },
      core: { value: core ? 1 : 0 },
      haze: { value: haze ? 1 : 0 },
      pointScale: { value: pointScale },
    }),
    [color, sparks, rise, core, haze, pointScale],
  );
  // Color is passed as a vec3 by the material below.
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.time!.value = clock.elapsedTime;
  });
  if (!origins.length) return null;
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        blending={sparks && !core ? AdditiveBlending : NormalBlending}
        uniforms={uniforms}
        vertexShader={`attribute float phase; attribute float travelLimit; attribute vec3 flow; attribute vec3 tintAttribute; varying vec3 particleTint; uniform float time; uniform float spark; uniform float rise; uniform float core; uniform float pointScale; uniform float haze; varying float life;
          void main(){particleTint=tintAttribute;life=fract(time*(spark>0.5?0.75:(haze>0.5?0.055:0.1))+phase);vec3 p=position;float travel=life*travelLimit;
          if(core<0.5){p.x+=sin(phase*91.0+travel*4.0)*(0.12+travel*1.4);p.z+=cos(phase*73.0+travel*3.0)*travel*1.4;p+=flow*travel*rise;}
          vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
          float width=core>0.5?0.45+sin(time*18.0+phase)*0.06:(spark>0.5?0.16:4.0+travel*15.0);
          gl_PointSize=min(180.0,width*pointScale/max(1.0,-mv.z));}`}
        fragmentShader={`varying vec3 particleTint; uniform float spark; uniform float core; uniform float haze; varying float life;
          void main(){vec3 tint=particleTint;float d=length(gl_PointCoord-0.5)*2.0;float soft=1.0-smoothstep(0.0,1.0,d);
          float a=soft*(core>0.5?0.95:(spark>0.5?(1.0-life)*0.95:(1.0-life*0.65)*(haze>0.5?0.18:0.36)));
          vec3 color=core>0.5?mix(tint,vec3(1.0,0.95,0.75),pow(soft,5.0)):(spark>0.5?tint:mix(tint,vec3(0.12),life*0.25));
          gl_FragColor=vec4(color,a);}`}
      />
    </points>
  );
}

function colorToRGB(value: string) {
  return new Color(value);
}

export function CrowdFlares({
  onOrigins,
  seats,
  homeColor,
  awayColor,
  occupancy,
}: {
  onOrigins?: (origins: FlareOrigin[]) => void;
  seats: readonly CrowdSeat[] | null;
  homeColor: string;
  awayColor: string;
  occupancy: number;
}) {
  const scene = useThree((s) => s.scene),
    compact = useThree((s) => s.size.width < 900);
  const [origins, setOrigins] = useState<FlareOrigin[]>([]);
  const points = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = scene.getObjectByName('stadium-structure');
    if (!root || !seats) {
      setOrigins([]);
      onOrigins?.([]);
      return;
    }
    const safe = clearCrowdSeats(root, seats),
      occupied = occupiedCrowdSeats(safe, occupancy);
    const plumeLimit = smokePlumeLimit(root);
    const selected = flareOrigins(
      safe.filter((_, i) => occupied[i]),
      homeColor,
      awayColor,
      compact ? 10 : 20,
      (seat, flow) => plumeLimit(flareEmitter(seat), flow),
    );
    setOrigins(selected);
    onOrigins?.(selected);
  }, [scene, seats, occupancy, compact, homeColor, awayColor, onOrigins]);
  const emitters = useMemo(
    () => origins.map((origin) => ({ ...origin, ...flareEmitter(origin) })),
    [origins],
  );
  return (
    <group ref={points} name="Sinalizadores da torcida">
      {
        <>
          <ParticleField origins={emitters} color={homeColor} count={origins.length} core />
          <ParticleField
            origins={emitters}
            color={homeColor}
            count={compact ? 260 : 560}
            rise={12}
          />
          <ParticleField
            origins={emitters}
            color="#a4a6a8"
            count={compact ? 100 : 200}
            rise={12}
            haze
          />
          <ParticleField
            origins={emitters}
            color={homeColor}
            count={compact ? 48 : 100}
            rise={2.4}
            sparks
          />
        </>
      }
    </group>
  );
}

export function MatchAtmosphere({ renderedView }: { renderedView: View }) {
  const group = useRef<Group>(null),
    compact = useThree((s) => s.size.width < 900);
  const origins = useMemo(() => [{ x: 0, y: -0.5, z: 0, rotation: 0 }], []);
  useFrame(() => {
    if (group.current) {
      const view = renderedView.current;
      group.current.position.set(view.ball.x, 0, view.ball.z);
      group.current.visible = ['shot', 'tackle', 'dribble', 'save'].includes(
        view.frame?.action.type ?? '',
      );
    }
  });
  return (
    <group ref={group}>
      <ParticleField
        origins={origins}
        color="#b2c778"
        count={compact ? 12 : 28}
        rise={0.35}
        sparks
      />
    </group>
  );
}
