/* eslint-disable react-hooks/immutability -- Three.js instance transforms and buffers require in-place updates in animation callbacks. */
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
  useSyncExternalStore,
  useEffect,
  type ReactNode,
} from 'react';
import { Color, InstancedMesh, Object3D, Mesh } from 'three';
import type { StadiumSnapshot, TrainingCenterSnapshot } from '@football/shared';

import { ClubCampus, StadiumSurroundings } from './club-campus';
import { StadiumNeighborhood } from './stadium-neighborhood';
import { GroundMist } from './ground-mist';
import { Pitch } from './pitch';
import { RealStadium } from './real-stadiums';
import { stadiumSkin } from './stadium-catalog';
import { realStadiumSeats, occupiedCrowdSeats, crowdNoise } from './stadium-seating';
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
      ['#315d55', '#334f78', '#875742', '#7c3b42', '#76783c'][
        (parseInt(stadium.id.slice(-4), 16) - 1) % 5
      ] ?? '#315d55',
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
  skin,
  occupancy,
  level,
  homeKit = { primary: '#315d55', secondary: '#ffffff' },
  awayKit = { primary: '#334f78', secondary: '#ffffff' },
}: {
  homeKit?: { primary: string; secondary: string };
  awayKit?: { primary: string; secondary: string };
  skin?: string | undefined;
  occupancy: number;
  level: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const shirts = useRef<InstancedMesh>(null);
  const mappedSeats = useMemo(() => (skin ? realStadiumSeats(skin) : null), [skin]);
  const count =
    mappedSeats?.length ??
    (level >= 4 ? (level === 5 ? 3 * 13 : 2 * 10) * 384 : 4 * (5 + level * 2) * 100);
  const dummy = useMemo(() => new Object3D(), []);
  const occupiedSeats = useMemo(
    () => (mappedSeats ? occupiedCrowdSeats(mappedSeats, occupancy) : null),
    [mappedSeats, occupancy],
  );
  useLayoutEffect(() => {
    if (!mesh.current || !heads.current || !shirts.current) return;
    const skin = ['#e2ac80', '#b77b51', '#754a36', '#f0c8a0'];
    const neutral = ['#d7d8cd', '#49534c', '#a4aaa3', '#38434b'];
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
      const mapped = mappedSeats?.[index];
      if (mapped) {
        dummy.position.set(mapped.x, mapped.y, mapped.z);
        dummy.rotation.set(0, mapped.rotation, 0);
      }
      const occupied = occupiedSeats
        ? occupiedSeats[index] === 1
        : crowdNoise(index + 17) < Math.min(1, Math.max(0, occupancy));
      const variation = crowdNoise(index + 29);
      const stature = 0.94 + crowdNoise(index + 53) * 0.12;
      const visitor = mapped
        ? (Math.atan2(mapped.z, mapped.x) + Math.PI) / (2 * Math.PI) < 0.3
        : level >= 4
          ? index % 384 < 115
          : seat < 30;
      const kit = {
        primary: visitor ? awayKit.primary : homeKit.primary,
        secondary: visitor ? awayKit.secondary : homeKit.secondary,
      };
      if (!mapped && level < 4) dummy.rotation.set(0, side < 2 ? 0 : Math.PI / 2, 0);
      // Jitter along the tread, never through the step or into the next row.
      const tangentX = Math.cos(dummy.rotation.y),
        tangentZ = -Math.sin(dummy.rotation.y);
      const jitter = (crowdNoise(index + 71) - 0.5) * 0.18;
      dummy.position.x += tangentX * jitter;
      dummy.position.z += tangentZ * jitter;
      dummy.position.y -= 0.425 - 0.36 * stature;
      dummy.rotation.y += (variation - 0.5) * 0.12;
      const shirtColor =
        variation < 0.14
          ? neutral[Math.floor(crowdNoise(index + 31) * neutral.length)]!
          : variation < 0.35
            ? kit.secondary
            : kit.primary;
      dummy.scale.set(
        occupied ? 0.62 * stature : 0,
        occupied ? 0.72 * stature : 0,
        occupied ? 0.4 : 0,
      );
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
      mesh.current.setColorAt(index, new Color(shirtColor));
      dummy.scale.set(
        occupied ? 0.15 * stature : 0,
        occupied ? 0.72 * stature : 0,
        occupied ? 0.42 : 0,
      );
      dummy.updateMatrix();
      shirts.current.setMatrixAt(index, dummy.matrix);
      shirts.current.setColorAt(index, new Color(kit.secondary));
      dummy.position.y += 0.56 * stature;
      dummy.scale.setScalar(occupied ? 0.23 * stature : 0);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);
      heads.current.setColorAt(
        index,
        new Color(skin[Math.floor(crowdNoise(index + 97) * skin.length)]),
      );
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    shirts.current.instanceMatrix.needsUpdate = true;
    if (shirts.current.instanceColor) shirts.current.instanceColor.needsUpdate = true;
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [
    count,
    dummy,
    occupancy,
    level,
    homeKit.primary,
    homeKit.secondary,
    awayKit.primary,
    awayKit.secondary,
    mappedSeats,
    occupiedSeats,
  ]);
  return (
    <group name={skin ? `Torcida: ${skin}` : 'Torcida: arquibancada padrão'}>
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
  cameraLocked = false,
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
  paused?: boolean;
  showNeighborhood?: boolean;
  cameraLocked?: boolean;
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
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.25}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} receiveShadow>
        <planeGeometry args={[3600, 3600]} />
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
      {stadiumSkin(stadium) ? (
        <RealStadium skin={stadiumSkin(stadium)!} />
      ) : level >= 4 ? (
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
          skin={stadiumSkin(stadium)}
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
      <group position={[70, 0, 0]}>
        <ClubCampus
          center={center}
          {...(focus === 'training' && !matchView && onSelectSector ? { onSelectSector } : {})}
        />
      </group>
      <StadiumSurroundings level={stadium.surroundingsLevel} stadium={stadium} />
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
        enableRotate={!cameraLocked}
        enableZoom={!cameraLocked}
        enablePan={false}
        minDistance={matchView ? 55 : 90}
        maxDistance={focus === 'training' ? 400 : 360}
        target={focus === 'training' ? [250, 0, 0] : matchView ? [0, 0, 0] : [10, 0, 0]}
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
const cameraMobileQuery = '(max-width: 760px)';
const cameraMobileSnapshot = () => window.matchMedia(cameraMobileQuery).matches;
const subscribeCameraMobile = (change: () => void) => {
  const media = window.matchMedia(cameraMobileQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};

export default function StadiumScene(props: {
  stadium: StadiumSnapshot;
  center: TrainingCenterSnapshot;
  onSelectSector?: (sector: string) => void;
  occupancy?: number;
  focus?: 'training';
  children?: ReactNode;
  matchView?: boolean;
  paused?: boolean;
  showNeighborhood?: boolean;
  homeKit?: { primary: string; secondary: string };
  awayKit?: { primary: string; secondary: string };
}) {
  const mobile = useSyncExternalStore(subscribeCameraMobile, cameraMobileSnapshot, () => false);
  const sceneRoot = useRef<HTMLDivElement>(null);
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    let visible = true;
    const update = () =>
      setInactive(document.hidden || !visible || Boolean(document.querySelector('dialog[open]')));
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      update();
    });
    if (sceneRoot.current) observer.observe(sceneRoot.current);
    document.addEventListener('visibilitychange', update);
    document.addEventListener('toggle', update, true);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      document.removeEventListener('toggle', update, true);
    };
  }, []);
  const [cameraUnlocked, setCameraUnlocked] = useState(false);
  const cameraLocked = mobile && !cameraUnlocked;
  const [loaded, setLoaded] = useState(false);
  const ready = useCallback(() => setLoaded(true), []);
  return (
    <div
      ref={sceneRoot}
      className="scene-root"
      data-scene-ready={loaded}
      data-camera-locked={cameraLocked}
    >
      {cameraLocked && <div className="scene-scroll-surface" aria-hidden="true" />}
      {mobile && (
        <button
          type="button"
          className="scene-camera-lock"
          aria-label={
            cameraLocked ? 'Desbloquear controle da câmera' : 'Bloquear controle da câmera'
          }
          aria-pressed={cameraLocked}
          title={cameraLocked ? 'Câmera travada' : 'Câmera livre'}
          onClick={() => setCameraUnlocked((value) => !value)}
        >
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path
              d={
                cameraLocked
                  ? 'M8 10V7a4 4 0 0 1 8 0v3M12 14v3'
                  : 'M15 10V5a4 4 0 0 1 8 0v2M12 14v3'
              }
            />
          </svg>
        </button>
      )}
      <SceneBoundary>
        <Canvas
          frameloop={props.paused || inactive ? 'demand' : 'always'}
          shadows={!mobile}
          dpr={mobile ? 1 : [1, 1.25]}
          camera={{
            position:
              props.focus === 'training'
                ? [390, 165, 180]
                : props.matchView
                  ? [95, 120, 110]
                  : [200, 165, 205],
            fov: 40,
            near: 2,
            far: 900,
          }}
          gl={{ antialias: !mobile, powerPreference: 'low-power' }}
          fallback={
            <>
              <div className="scene-fallback">Seu navegador não oferece visualização 3D.</div>
              <SceneReady ready={ready} />
            </>
          }
        >
          <Suspense fallback={null}>
            <StadiumWorld
              {...props}
              cameraLocked={cameraLocked}
              occupancy={props.occupancy ?? 0.85}
            />
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
