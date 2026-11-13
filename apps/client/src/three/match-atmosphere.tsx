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
  ShaderMaterial,
  NormalBlending,
} from 'three';
import type { samplePlayback } from './match-playback';
import type { CrowdSeat } from './stadium-seating';
import { crowdNoise, occupiedCrowdSeats } from './stadium-seating';
import { clearCrowdSeats, smokePlumeLimit } from './crowd-clearance';
type View = RefObject<ReturnType<typeof samplePlayback>>;

export function MatchReferee({ renderedView, ended }: { renderedView: View; ended: boolean }) {
  const referee = useRef<Group>(null),
    arm = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]),
    stride = useRef(0);
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
    const moving = distance > 0.4;
    if (moving) {
      referee.current.position.x += (dx / distance) * step;
      referee.current.position.z += (dz / distance) * step;
      stride.current += step * 2.4;
    }
    referee.current.rotation.y = moving
      ? Math.atan2(dx, dz)
      : Math.atan2(ball.x - referee.current.position.x, ball.z - referee.current.position.z);
    for (let i = 0; i < 2; i++)
      if (legs.current[i])
        legs.current[i]!.rotation.x = moving
          ? Math.sin(stride.current + (i ? Math.PI : 0)) * 0.65
          : 0;
    const currentMinute = view.frame
      ? view.frame.minute + (view.frame.endMinute - view.frame.minute) * view.progress
      : 0;
    const whistling =
      ended ||
      (currentMinute >= 45 && currentMinute < 45.25) ||
      (view.frame?.action.outcome === 'goal' && view.progress > 0.84) ||
      (view.progress < 0.3 && ['foul', 'kickoff', 'goal'].includes(view.frame?.action.type ?? ''));
    if (arm.current)
      arm.current.rotation.x = whistling ? -1.8 : moving ? -Math.sin(stride.current) * 0.5 : 0;
  });
  return (
    <group ref={referee} position={[7, 0.12, -6]} name="Árbitro de magenta">
      <mesh position={[0, 1.27, 0]}>
        <boxGeometry args={[0.65, 0.75, 0.35]} />
        <meshStandardMaterial color="#e5009a" />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <sphereGeometry args={[0.24, 8, 6]} />
        <meshStandardMaterial color="#b27b55" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <group
            ref={(node) => {
              legs.current[side === -1 ? 0 : 1] = node;
            }}
            position={[side * 0.18, 0.95, 0]}
          >
            <mesh position={[0, -0.4, 0]}>
              <boxGeometry args={[0.24, 0.8, 0.28]} />
              <meshStandardMaterial color="#17212a" />
            </mesh>
            <mesh position={[0, -0.86, 0.08]}>
              <boxGeometry args={[0.26, 0.16, 0.4]} />
              <meshStandardMaterial color="#101a24" />
            </mesh>
          </group>
          <group ref={side === 1 ? arm : null} position={[side * 0.43, 1.55, 0]}>
            <mesh position={[0, -0.3, 0]}>
              <boxGeometry args={[0.18, 0.65, 0.23]} />
              <meshStandardMaterial color="#e5009a" />
            </mesh>
          </group>
        </group>
      ))}
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
