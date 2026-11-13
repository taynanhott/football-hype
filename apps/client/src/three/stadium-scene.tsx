import { genericCrowdSeats } from './generic-crowd-seats';
import type { FlareOrigin } from './flare-layout';
import { CrowdPeople } from './crowd-people';
import { PitchEquipment } from './pitch-equipment';
import { CrowdFlares } from './match-atmosphere';
import { CrowdFlags, type FlagClub } from './crowd-flags';
import { LevelTwoStadium } from './level-two-stadium';
import { levelTwoCrowdSeats } from './level-two-layout';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, Sky, useGLTF, Clone } from '@react-three/drei';
import { KTX2Loader } from 'three-stdlib';
import {
  Component,
  Suspense,
  useMemo,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
  useEffect,
  type ReactNode,
} from 'react';
import { InstancedMesh, Object3D, Mesh } from 'three';
import type { StadiumSnapshot, TrainingCenterSnapshot } from '@football/shared';

import { ClubCampus, StadiumSurroundings } from './club-campus';
import { StadiumNeighborhood } from './stadium-neighborhood';
import { GroundMist } from './ground-mist';
import { Pitch } from './pitch';
import { RealStadium } from './real-stadiums';
import { stadiumSkin } from './stadium-catalog';
import { realStadiumSeats, crowdNoise } from './stadium-seating';
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
  homeClub,
  awayClub,
  skin,
  occupancy,
  level,
  homeKit = { primary: '#315d55', secondary: '#ffffff' },
  awayKit = { primary: '#334f78', secondary: '#ffffff' },
}: {
  homeClub?: FlagClub;
  awayClub?: FlagClub;
  homeKit?: { primary: string; secondary: string };
  awayKit?: { primary: string; secondary: string };
  skin?: string | undefined;
  occupancy: number;
  level: number;
}) {
  const mappedSeats = useMemo(
    () =>
      skin ? realStadiumSeats(skin) : level === 2 ? levelTwoCrowdSeats() : genericCrowdSeats(level),
    [skin, level],
  );
  const [flares, setFlares] = useState<FlareOrigin[]>([]);
  return (
    <group name={skin ? `Torcida: ${skin}` : 'Torcida: arquibancada padrão'}>
      {homeClub && awayClub && (
        <CrowdFlags seats={mappedSeats} occupancy={occupancy} home={homeClub} away={awayClub} />
      )}
      <CrowdFlares
        seats={mappedSeats}
        homeColor={homeKit.primary}
        awayColor={awayKit.primary}
        occupancy={occupancy}
        onOrigins={setFlares}
      />
      <CrowdPeople
        seats={mappedSeats}
        occupancy={occupancy}
        flares={flares}
        homeKit={homeKit}
        awayKit={awayKit}
      />
    </group>
  );
}

class ParticlePool {
  readonly particles: {
    x: number;
    y: number;
    z: number;
    speed: number;
    driftX: number;
    driftZ: number;
    tiltX: number;
    tiltY: number;
    tiltZ: number;
    size: number;
    phase: number;
  }[];
  constructor(count: number) {
    this.particles = Array.from({ length: count }, (_, index) => ({
      x: (crowdNoise(index + 171) - 0.5) * 76,
      y: crowdNoise(index + 511) * 24,
      z: (crowdNoise(index + 881) - 0.5) * 110,
      speed: 0.65 + crowdNoise(index + 19) * 0.85,
      driftX: (crowdNoise(index + 27) - 0.5) * 0.6,
      driftZ: (crowdNoise(index + 37) - 0.5) * 0.5,
      tiltX: crowdNoise(index + 41) * 1.4,
      tiltY: crowdNoise(index + 43) * Math.PI,
      tiltZ: crowdNoise(index + 47) * 1.2,
      size: 0.65 + crowdNoise(index + 51) * 0.7,
      phase: crowdNoise(index + 59) * Math.PI * 2,
    }));
  }
  update(delta: number): void {
    for (const particle of this.particles) {
      particle.phase += delta * 0.5;
      particle.y -= delta * particle.speed;
      particle.x += delta * (particle.driftX + Math.sin(particle.phase) * 0.12);
      particle.z += delta * particle.driftZ;
      if (particle.y < 0) {
        particle.y = 22;
        particle.x = Math.max(-38, Math.min(38, particle.x));
        particle.z = Math.max(-55, Math.min(55, particle.z));
      }
    }
  }
}
function Atmosphere({ enabled }: { enabled: boolean }) {
  const compact = useThree((s) => s.size.width < 900);
  const pool = useMemo(() => new ParticlePool(compact ? 72 : 160), [compact]);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((_, delta) => {
    if (!mesh.current || !enabled) return;
    pool.update(delta);
    pool.particles.forEach((particle, index) => {
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.rotation.set(particle.tiltX, particle.tiltY, particle.tiltZ);
      dummy.scale.setScalar(particle.size);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return enabled ? (
    <instancedMesh
      name="Confetes de campo"
      ref={mesh}
      args={[undefined, undefined, pool.particles.length]}
    >
      <planeGeometry args={[0.09, 0.16]} />
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
  homeClub,
  awayClub,
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
  homeClub?: FlagClub;
  awayClub?: FlagClub;
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
      <PitchEquipment />
      <group name="stadium-structure">
        {stadiumSkin(stadium) ? (
          <RealStadium skin={stadiumSkin(stadium)!} />
        ) : level === 2 ? (
          <LevelTwoStadium />
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
      </group>
      {matchView && (
        <Crowd
          skin={stadiumSkin(stadium)}
          level={level}
          occupancy={occupancy}
          {...(homeClub ? { homeClub } : {})}
          {...(awayClub ? { awayClub } : {})}
          {...(homeKit ? { homeKit } : {})}
          {...(awayKit ? { awayKit } : {})}
        />
      )}
      <Atmosphere enabled={Boolean(matchView) && occupancy > 0.5 && level >= 4} />
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
  homeClub?: FlagClub;
  awayClub?: FlagClub;
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
