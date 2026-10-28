import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, Sky, useGLTF, Clone } from '@react-three/drei';
import { KTX2Loader } from 'three-stdlib';
import {
  Component,
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { Color, InstancedMesh, Object3D, Mesh } from 'three';
import type { StadiumSnapshot, TrainingCenterSnapshot } from '@football/shared';

import { ClubCampus, StadiumSurroundings } from './club-campus';
import { StadiumNeighborhood } from './stadium-neighborhood';
import { GroundMist } from './ground-mist';
import { Pitch } from './pitch';
import { ModernArena, TraditionalDetails } from './stadium-architecture';

type Position = [number, number, number];
type SectorEntity = {
  id: string;
  position: Position;
  rotation: Position;
  width: number;
  level: number;
  color: string;
};
function stadiumEntities(stadium: StadiumSnapshot): SectorEntity[] {
  return stadium.sectors.map((sector) => ({
    color:
      stadium.color ??
      ['#315d55', '#334f78', '#875742', '#7c3b42', '#76783c'][
        (parseInt(stadium.id.slice(-4), 16) - 1) % 5
      ] ??
      '#315d55',
    id: sector.id,
    level: Math.max(...stadium.sectors.map((item) => item.level)),
    width: sector.id === 'north' || sector.id === 'south' ? 78 : 110,
    position:
      sector.id === 'north'
        ? [0, 0, -63]
        : sector.id === 'south'
          ? [0, 0, 63]
          : sector.id === 'east'
            ? [45, 0, 0]
            : [-45, 0, 0],
    rotation: [
      0,
      sector.id === 'south'
        ? Math.PI
        : sector.id === 'east'
          ? -Math.PI / 2
          : sector.id === 'west'
            ? Math.PI / 2
            : 0,
      0,
    ],
  }));
}
function Stand({ entity }: { entity: SectorEntity }) {
  const gl = useThree((state) => state.gl);
  const ktx = useMemo(
    () => new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(gl),
    [gl],
  );
  const { scene } = useGLTF(`/models/stand-level-${entity.level}.glb`, false, true, (loader) =>
    loader.setKTX2Loader(ktx),
  );
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (
        object.name === 'Cobertura' &&
        (entity.level === 1 ||
          (entity.id !== 'west' && (entity.level === 2 || entity.id !== 'east')))
      )
        object.visible = false;
    });
    return clone;
  }, [scene, entity.level, entity.id]);
  return (
    <group position={entity.position} rotation={entity.rotation} scale={[entity.width, 1, 1]}>
      <Clone
        object={model}
        castShadow
        receiveShadow
        inject={(object) =>
          object instanceof Mesh &&
          !Array.isArray(object.material) &&
          object.material.name === 'Arquibancada' ? (
            <meshStandardMaterial color={entity.color} roughness={0.8} />
          ) : null
        }
      />
    </group>
  );
}
function Crowd({
  occupancy,
  level,
  homeKit = { primary: '#315d55', secondary: '#ffffff' },
  awayKit = { primary: '#334f78', secondary: '#ffffff' },
}: {
  homeKit?: { primary: string; secondary: string };
  awayKit?: { primary: string; secondary: string };
  occupancy: number;
  level: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const shirts = useRef<InstancedMesh>(null);
  const count = level >= 4 ? (level === 5 ? 3 * 13 : 2 * 10) * 384 : 4 * (5 + level * 2) * 100;
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current || !heads.current || !shirts.current) return;
    const skin = ['#e2ac80', '#b77b51', '#754a36', '#f0c8a0'];
    for (let index = 0; index < count; index++) {
      const side = index % 4;
      const row = Math.floor(index / 4) % (5 + level * 2);
      const seat = Math.floor(index / (4 * (5 + level * 2)));
      const along = (seat / 100 - 0.5) * (side < 2 ? 72 : 100);
      dummy.position.set(
        side < 2 ? along : (side === 2 ? 1 : -1) * (44 + row * 0.95),
        2.1 + row * 0.7,
        side < 2 ? (side === 0 ? -1 : 1) * (62 + row * 0.95) : along,
      );
      if (level >= 4) {
        const rows = level === 5 ? 13 : 10;
        const seatIndex = index % 384;
        const block = Math.floor(seatIndex / 4);
        const angle = (block / 96) * Math.PI * 2;
        const nextAngle = ((block + 1) / 96) * Math.PI * 2;
        const fraction = ((seatIndex % 4) + 0.5) / 4;
        const rowIndex = Math.floor(index / 384) % rows;
        const tier = Math.floor(index / (384 * rows));
        const distance = tier * 10 + rowIndex * 0.88;
        dummy.position.set(
          (Math.cos(angle) * (1 - fraction) + Math.cos(nextAngle) * fraction) * (51 + distance),
          2.05 + tier * 12 + rowIndex * 0.65,
          (Math.sin(angle) * (1 - fraction) + Math.sin(nextAngle) * fraction) * (73 + distance),
        );
        dummy.rotation.set(
          0,
          -Math.atan2((73 + distance) * Math.cos(angle), -(51 + distance) * Math.sin(angle)),
          0,
        );
      }
      const occupied = ((index * 7919) % count) / count < Math.min(1, Math.max(0, occupancy));
      const visitor = level >= 4 ? index % 384 < 115 : seat < 30;
      const kit = visitor ? awayKit : homeKit;
      if (level < 4) dummy.rotation.set(0, side < 2 ? 0 : Math.PI / 2, 0);
      dummy.scale.set(occupied ? 0.65 : 0, occupied ? 0.85 : 0, occupied ? 0.45 : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
      mesh.current.setColorAt(index, new Color(kit.primary));
      dummy.scale.set(occupied ? 0.18 : 0, occupied ? 0.85 : 0, occupied ? 0.47 : 0);
      dummy.updateMatrix();
      shirts.current.setMatrixAt(index, dummy.matrix);
      shirts.current.setColorAt(index, new Color(kit.secondary));
      dummy.position.y += 0.63;
      dummy.scale.setScalar(occupied ? 0.28 : 0);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);
      heads.current.setColorAt(index, new Color(skin[index % skin.length]));
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    shirts.current.instanceMatrix.needsUpdate = true;
    if (shirts.current.instanceColor) shirts.current.instanceColor.needsUpdate = true;
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [count, dummy, occupancy, level, homeKit, awayKit]);
  useFrame(({ clock }) => {
    const bounce = Math.sin(clock.elapsedTime * 5) * occupancy * 0.09;
    for (const part of [mesh.current, heads.current, shirts.current])
      if (part) part.position.y = bounce;
  });
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={shirts} args={[undefined, undefined, count]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
class ParticlePool {
  readonly particles = Array.from({ length: 60 }, (_, index) => ({
    x: Math.sin(index * 13) * 38,
    y: index % 18,
    z: Math.cos(index * 7) * 55,
    speed: 1 + (index % 4),
  }));
  update(delta: number): void {
    for (const particle of this.particles) {
      particle.y -= delta * particle.speed;
      if (particle.y < 0) particle.y = 20;
    }
  }
}
function Atmosphere({ enabled }: { enabled: boolean }) {
  const pool = useMemo(() => new ParticlePool(), []);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((_, delta) => {
    if (!mesh.current || !enabled) return;
    pool.update(delta);
    pool.particles.forEach((particle, index) => {
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.rotation.z += delta;
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return enabled ? (
    <instancedMesh ref={mesh} args={[undefined, undefined, pool.particles.length]}>
      <planeGeometry args={[0.3, 0.7]} />
      <meshBasicMaterial color="#f3d471" side={2} />
    </instancedMesh>
  ) : null;
}
function StadiumWorld({
  stadium,
  center,
  occupancy,
  focus,
  children,
  matchView,
  showNeighborhood = true,
  onSelectSector,
  homeKit,
  awayKit,
}: {
  stadium: StadiumSnapshot;
  center: TrainingCenterSnapshot;
  onSelectSector?: (sector: string) => void;
  occupancy: number;
  focus?: 'training' | undefined;
  children?: ReactNode;
  matchView?: boolean;
  showNeighborhood?: boolean;
  homeKit?: { primary: string; secondary: string };
  awayKit?: { primary: string; secondary: string };
}) {
  const entities = useMemo(() => stadiumEntities(stadium), [stadium]);
  const level = Math.max(...stadium.sectors.map((sector) => sector.level));
  const color = entities[0]?.color ?? '#315d55';
  return (
    <>
      <Sky sunPosition={[100, 40, 20]} turbidity={7} rayleigh={1.2} />
      <ambientLight intensity={1.8} />
      <fog attach="fog" args={['#c6cfcb', 420, 850]} />
      <directionalLight
        position={[60, 90, 30]}
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.25}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} receiveShadow>
        <planeGeometry args={[1800, 1800]} />
        <meshStandardMaterial color={stadium.surroundingsLevel > 2 ? '#85976b' : '#9d9b7f'} />
      </mesh>
      <GroundMist />
      <Pitch level={stadium.pitchLevel} />
      {children}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * 51]}>
          <mesh position={[0, 2.4, 0]}>
            <boxGeometry args={[7.3, 0.15, 0.2]} />
            <meshStandardMaterial color="white" />
          </mesh>
          {[-3.6, 3.6].map((x) => (
            <mesh key={x} position={[x, 1.2, 0]}>
              <boxGeometry args={[0.15, 2.4, 0.2]} />
              <meshStandardMaterial color="white" />
            </mesh>
          ))}
          <mesh position={[0, 1.2, side * 1.3]}>
            <boxGeometry args={[7.3, 2.4, 0.1]} />
            <meshStandardMaterial color="#e4e4da" wireframe />
          </mesh>
        </group>
      ))}
      {level >= 4 ? (
        <ModernArena level={level} color={color} />
      ) : (
        <>
          {entities.map((entity) => (
            <group key={entity.id}>
              <Stand entity={entity} />
              {level === 3 && (
                <group position={[0, 10, 0]}>
                  <Stand
                    entity={{
                      ...entity,
                      position: [entity.position[0] * 1.12, 0, entity.position[2] * 1.08],
                    }}
                  />
                </group>
              )}
            </group>
          ))}
          <TraditionalDetails level={level} color={color} />
        </>
      )}
      {matchView && (
        <Crowd
          level={level}
          occupancy={occupancy}
          {...(homeKit ? { homeKit } : {})}
          {...(awayKit ? { awayKit } : {})}
        />
      )}
      <Atmosphere enabled={Boolean(matchView) && occupancy > 0.85} />
      <group visible={showNeighborhood}>
        <StadiumNeighborhood seed={parseInt(stadium.clubId.slice(-4), 16) || 17} />
      </group>
      <ClubCampus
        center={center}
        {...(focus === 'training' && !matchView && onSelectSector ? { onSelectSector } : {})}
      />
      <StadiumSurroundings level={stadium.surroundingsLevel} />
      <ContactShadows
        position={[0, -0.13, 0]}
        scale={320}
        opacity={0.25}
        blur={2.5}
        far={40}
        depthWrite={false}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={matchView ? 55 : 90}
        maxDistance={focus === 'training' ? 400 : 360}
        target={focus === 'training' ? [180, 0, 0] : matchView ? [0, 0, 0] : [10, 0, 0]}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate={!matchView}
        autoRotateSpeed={0.2}
      />
    </>
  );
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        A visualização 3D não está disponível neste dispositivo. As melhorias continuam disponíveis
        abaixo.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function StadiumScene(props: {
  stadium: StadiumSnapshot;
  center: TrainingCenterSnapshot;
  onSelectSector?: (sector: string) => void;
  occupancy?: number;
  focus?: 'training';
  children?: ReactNode;
  matchView?: boolean;
  showNeighborhood?: boolean;
  homeKit?: { primary: string; secondary: string };
  awayKit?: { primary: string; secondary: string };
}) {
  const [loaded, setLoaded] = useState(false);
  const ready = useCallback(() => setLoaded(true), []);
  return (
    <div className="scene-root" data-scene-ready={loaded}>
      <SceneBoundary>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position:
              props.focus === 'training'
                ? [320, 165, 180]
                : props.matchView
                  ? [95, 120, 110]
                  : [200, 165, 205],
            fov: 40,
            near: 2,
            far: 900,
          }}
          gl={{ antialias: true, powerPreference: 'low-power' }}
          fallback={
            <>
              <div className="scene-fallback">Seu navegador não oferece visualização 3D.</div>
              <SceneReady ready={ready} />
            </>
          }
        >
          <Suspense fallback={null}>
            <StadiumWorld {...props} occupancy={props.occupancy ?? 0.85} />
            <SceneReady ready={ready} />
          </Suspense>
        </Canvas>
        {!loaded && <div className="scene-loading-overlay">Preparando sua arena…</div>}
      </SceneBoundary>
    </div>
  );
}

function SceneReady({ ready }: { ready: () => void }) {
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(ready);
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready]);
  return null;
}
