import { useMemo, createContext, useContext } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import type { TrainingCenterSnapshot } from '@football/shared';
import { Pitch } from './pitch';

const CampusColor = createContext<string | undefined>(undefined);
type Point = [number, number, number];
function Box({
  at,
  size,
  color = '#e6e0cf',
}: {
  at: Point;
  size: Point;
  color?: string | undefined;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}
function Building({
  width,
  depth,
  height,
  color = '#e5dfcf',
}: {
  width: number;
  depth: number;
  height: number;
  color?: string | undefined;
}) {
  const campusColor = useContext(CampusColor);
  return (
    <group>
      <Box at={[0, height / 2, 0]} size={[width, height, depth]} color={campusColor ?? color} />
      <Box at={[0, height + 0.4, 0]} size={[width + 1, 0.8, depth + 1]} color="#345c54" />
      {Array.from({ length: Math.floor(width / 4) }, (_, index) => (
        <Box
          key={index}
          at={[-width / 2 + 2 + index * 4, height * 0.6, depth / 2 + 0.06]}
          size={[2.4, height * 0.45, 0.15]}
          color="#6fabb5"
        />
      ))}
      <Box at={[0, 2, depth / 2 + 0.12]} size={[3, 4, 0.2]} color="#284c51" />
    </group>
  );
}
function Pool({ large = false }: { large?: boolean }) {
  return (
    <group position={[0, 0.1, 20]}>
      <Box at={[0, 0, 0]} size={[large ? 30 : 22, 0.4, large ? 18 : 12]} color="#e9e4cf" />
      <Box at={[0, 0.3, 0]} size={[large ? 27 : 19, 0.2, large ? 15 : 9]} color="#43b8cf" />
      {large &&
        [-8, -4, 0, 4, 8].map((x) => (
          <Box key={x} at={[x, 0.45, 0]} size={[0.15, 0.1, 15]} color="#e2eddd" />
        ))}
    </group>
  );
}
function Gym({ level }: { level: number }) {
  return (
    <group position={[132, 0, -68]}>
      <Building width={18 + level * 2} depth={16} height={level >= 4 ? 12 : 6} color="#d8d3b7" />
      {Array.from({ length: level + 1 }, (_, index) => (
        <group key={index} position={[-12 + index * 6, 0, -15]}>
          <Box at={[0, 1.8, 0]} size={[3, 0.7, 6]} color="#335258" />
          <Box at={[0, 3, -2]} size={[0.5, 5, 0.5]} color="#b4babb" />
          <mesh position={[0, 4.5, -2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, 4, 8]} />
            <meshStandardMaterial color="#353e43" />
          </mesh>
          {[-2, 2].map((x) => (
            <mesh key={x} position={[x, 4.5, -2]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[1.1, 1.1, 0.6, 10]} />
              <meshStandardMaterial color="#202f35" />
            </mesh>
          ))}
        </group>
      ))}
      {level >= 3 && <Pool large={level === 5} />}
      {level >= 4 && <Box at={[0, 13, -1]} size={[16, 0.4, 10]} color="#385a70" />}
      {level === 5 && (
        <>
          <Box at={[-22, 3, 8]} size={[1, 6, 25]} color="#eadab1" />
          <Box at={[22, 3, 8]} size={[1, 6, 25]} color="#eadab1" />
          <Box at={[0, 6.5, 8]} size={[45, 1, 26]} color="#e5dfc8" />
        </>
      )}
    </group>
  );
}
function Medical({ level }: { level: number }) {
  const height = level >= 4 ? 22 : level >= 2 ? 10 : 6;
  return (
    <group position={[132, 0, -5]}>
      <Building
        width={level === 1 ? 15 : 25}
        depth={level === 1 ? 14 : 24}
        height={height}
        color="#eeeae0"
      />
      <Box at={[0, height + 1, 0]} size={[7, 0.5, 2]} color="#c54a42" />
      <Box at={[0, height + 1, 0]} size={[2, 0.5, 7]} color="#c54a42" />
      {level >= 2 && (
        <group position={[-17, 0, 0]}>
          <Building width={10} depth={18} height={6} />
        </group>
      )}
      {level >= 3 && (
        <>
          <Box at={[18, 2, 12]} size={[5, 4, 9]} color="#f6f2e7" />
          <Box at={[18, 2.8, 16.6]} size={[4, 1, 0.2]} color="#4c8395" />
          <Box at={[18, 4.3, 12]} size={[3, 0.5, 1]} color="#c44740" />
        </>
      )}
      {level === 5 && (
        <group position={[0, height + 1.2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[11, 32]} />
            <meshStandardMaterial color="#627571" />
          </mesh>
          <Box at={[-2, 0.15, 0]} size={[0.7, 0.2, 6]} color="#f0e5b4" />
          <Box at={[2, 0.15, 0]} size={[0.7, 0.2, 6]} color="#f0e5b4" />
          <Box at={[0, 0.15, 0]} size={[4, 0.2, 0.7]} color="#f0e5b4" />
          <group position={[0, 1.6, -1]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[1.3, 3, 4, 8]} />
              <meshStandardMaterial color="#d6ded4" />
            </mesh>
            <Box at={[0, 2.8, 0]} size={[12, 0.2, 0.4]} color="#263f43" />
            <Box at={[0, 0.7, 4]} size={[0.6, 0.6, 6]} color="#d6ded4" />
          </group>
        </group>
      )}
    </group>
  );
}
function Scout({ level }: { level: number }) {
  return (
    <group position={[130, 0, 53]}>
      <Building width={16 + level * 2} depth={16} height={5 + level * 2} color="#dfccb0" />
      {level >= 2 && (
        <group position={[0, 9 + level * 2, 0]}>
          <mesh rotation={[0.4, 0, 0]}>
            <sphereGeometry args={[3 + level * 0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#dce1dc" side={2} />
          </mesh>
          <Box at={[0, -3, 0]} size={[0.5, 5, 0.5]} color="#455f61" />
        </group>
      )}
      {Array.from({ length: level }, (_, index) => (
        <group key={index} position={[-10 + index * 5, 0, 15]}>
          <Box at={[0, 5, 0]} size={[0.2, 10, 0.2]} color="#dde1d5" />
          <Box
            at={[1.5, 8, 0]}
            size={[3, 2, 0.2]}
            color={['#d0b563', '#447d63', '#bc6155', '#3c677b', '#e8dfbd'][index]}
          />
        </group>
      ))}
      {level >= 4 && (
        <group position={[22, 0, 0]}>
          <Building width={12} depth={20} height={18} color="#647f82" />
        </group>
      )}
    </group>
  );
}
function TrainingHall() {
  const arch = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-25, 0, 0),
        new Vector3(-20, 15, 0),
        new Vector3(0, 22, 0),
        new Vector3(20, 15, 0),
        new Vector3(25, 0, 0),
      ]),
    [],
  );
  return (
    <group>
      <mesh scale={[25, 22, 39]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#dce8df" transparent opacity={0.45} side={2} />
      </mesh>
      {[-30, -15, 0, 15, 30].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <tubeGeometry args={[arch, 20, 0.6, 6, false]} />
          <meshStandardMaterial color="#f2eddb" />
        </mesh>
      ))}
    </group>
  );
}
function Coaching({ level }: { level: number }) {
  return (
    <group position={[200, 0, 28]}>
      <group scale={[0.6, 1, 0.6]}>
        <Pitch level={Math.min(5, level + 1)} />
      </group>
      {level >= 2 && (
        <group position={[52, 0, 0]} scale={[0.6, 1, 0.6]}>
          <Pitch level={Math.min(5, level + 1)} />
        </group>
      )}
      {level >= 3 && (
        <group position={[25, 0, -43]}>
          <Building width={40} depth={12} height={7} />
        </group>
      )}
      {level >= 4 && <TrainingHall />}
      {level === 5 && (
        <group position={[52, 0, 0]}>
          <TrainingHall />
        </group>
      )}
      {[-1, 1].map((side) => (
        <Box key={side} at={[side * 22, 2.5, -38]} size={[10, 5, 3]} color="#235c4e" />
      ))}
    </group>
  );
}
function Marketing({ level }: { level: number }) {
  return (
    <group position={[205, 0, -77]}>
      <Building width={24 + level * 2} depth={20} height={6 + level * 2} color="#b9cbbf" />
      <Box at={[0, 8 + level * 2, 0]} size={[20, 7, 1]} color="#183e38" />
      {Array.from({ length: level }, (_, index) => (
        <Box
          key={index}
          at={[-8 + index * 4, 8 + level * 2, 0.6]}
          size={[2, 3, 0.2]}
          color="#d9cd8b"
        />
      ))}
      {level >= 3 && (
        <group position={[0, 0, 20]}>
          <Box at={[0, 1, 0]} size={[30, 2, 12]} color="#74887d" />
          {[-10, 0, 10].map((x) => (
            <group key={x} position={[x, 3, 0]}>
              <mesh>
                <cylinderGeometry args={[1.5, 2, 3, 8]} />
                <meshStandardMaterial color="#d4ad52" metalness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {level === 5 && <Box at={[0, 21, 0]} size={[38, 1, 25]} color="#dce7d2" />}
    </group>
  );
}
export function ClubCampus({
  center,
  onSelectSector,
}: {
  center: TrainingCenterSnapshot;
  onSelectSector?: (sector: string) => void;
}) {
  return (
    <CampusColor.Provider value={center.color}>
      <group>
        <Box at={[188, -0.08, -10]} size={[170, 0.1, 185]} color="#c1c4ad" />
        <group
          onClick={(event) => {
            if (onSelectSector && event.delta <= 5) {
              event.stopPropagation();
              onSelectSector('fitness');
            }
          }}
        >
          <Gym level={center.levels.fitness} />
        </group>
        <group
          onClick={(event) => {
            if (onSelectSector && event.delta <= 5) {
              event.stopPropagation();
              onSelectSector('medical');
            }
          }}
        >
          <Medical level={center.levels.medical} />
        </group>
        <group
          onClick={(event) => {
            if (onSelectSector && event.delta <= 5) {
              event.stopPropagation();
              onSelectSector('scouting');
            }
          }}
        >
          <Scout level={center.levels.scouting} />
        </group>
        <group
          onClick={(event) => {
            if (onSelectSector && event.delta <= 5) {
              event.stopPropagation();
              onSelectSector('coaching');
            }
          }}
        >
          <Coaching level={center.levels.coaching} />
        </group>
        <group
          onClick={(event) => {
            if (onSelectSector && event.delta <= 5) {
              event.stopPropagation();
              onSelectSector('marketing');
            }
          }}
        >
          <Marketing level={center.levels.marketing} />
        </group>
      </group>
    </CampusColor.Provider>
  );
}
function Lamp({ at }: { at: Point }) {
  return (
    <group position={at}>
      <Box at={[0, 4, 0]} size={[0.35, 8, 0.35]} color="#475956" />
      <Box at={[0, 8, 0]} size={[3, 0.5, 1.3]} color="#f5e7b2" />
    </group>
  );
}
function Shop({ at, color }: { at: Point; color: string }) {
  return (
    <group position={at}>
      <Building width={15} depth={12} height={6} />
      <Box at={[0, 6.5, 7]} size={[17, 1, 4]} color={color} />
      <Box at={[0, 8, 0]} size={[12, 2, 1]} color={color} />
    </group>
  );
}
export function StadiumSurroundings({ level }: { level: number }) {
  return (
    <group>
      {level >= 2 && (
        <>
          <Box at={[0, -0.05, 126]} size={[190, 0.1, 22]} color="#b2b4a5" />
          <Box at={[-119, -0.04, 15]} size={[38, 0.1, 96]} color="#7d8982" />
          {Array.from({ length: level * 3 }, (_, index) => (
            <group
              key={index}
              position={[-131 + (index % 2) * 19, 0, -24 + Math.floor(index / 2) * 12]}
            >
              <Box at={[0, 0.02, 0]} size={[0.2, 0.1, 10]} color="#e8e4d0" />
              <Box
                at={[6, 1.6, 0]}
                size={[6, 3, 9]}
                color={['#d5dcd5', '#3c646c', '#944c46'][index % 3]}
              />
              <Box at={[6, 3.2, 0]} size={[5, 0.4, 4]} color="#749a9e" />
            </group>
          ))}
        </>
      )}
      {Array.from({ length: level >= 2 ? 8 + level * 2 : 4 }, (_, index) => (
        <Lamp key={index} at={[-95 + index * 12, 0, 139]} />
      ))}
      {level >= 3 && (
        <>
          <Shop at={[-102, 0, -62]} color="#ba7052" />
          <Shop at={[-123, 0, -62]} color="#44876c" />
          <group position={[0, 0, 128]}>
            <Box at={[0, 2, 0]} size={[9, 4, 9]} color="#aaa68f" />
            <Box at={[0, 7, 0]} size={[3, 6, 2]} color="#9b8754" />
            <mesh position={[0, 11, 0]}>
              <sphereGeometry args={[1.5, 8, 6]} />
              <meshStandardMaterial color="#9b8754" metalness={0.5} />
            </mesh>
            <Box at={[3, 5, 0]} size={[6, 1.5, 1.5]} color="#9b8754" />
            <mesh position={[6, 4.5, 0]}>
              <sphereGeometry args={[1.5, 8, 6]} />
              <meshStandardMaterial color="#d9c586" />
            </mesh>
          </group>
        </>
      )}
      {level >= 4 && (
        <>
          <Shop at={[52, 0, 128]} color="#2e6555" />
          <Shop at={[-50, 0, 128]} color="#d0b264" />
          {[-125, 125].map((x) => (
            <group key={x} position={[x, 0, 100]}>
              <Box at={[0, 7, 0]} size={[0.4, 14, 0.4]} color="#eee5c9" />
              <Box at={[3, 12, 0]} size={[6, 4, 0.2]} color="#39705d" />
            </group>
          ))}
        </>
      )}
      {level === 5 && (
        <>
          <group position={[-82, 0.1, 112]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[9, 32]} />
              <meshStandardMaterial color="#4fabbc" />
            </mesh>
            <mesh position={[0, 2, 0]}>
              <cylinderGeometry args={[0.6, 1, 4, 8]} />
              <meshStandardMaterial color="#dedccc" />
            </mesh>
          </group>
          <Box at={[-118, 6.5, 15]} size={[40, 1, 99]} color="#98a6a0" />
          {[-35, 15, 65].map((z) => (
            <Box key={z} at={[-136, 3, z]} size={[0.5, 6, 0.5]} color="#d7dccf" />
          ))}
        </>
      )}
    </group>
  );
}
