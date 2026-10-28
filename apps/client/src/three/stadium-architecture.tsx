import { useLayoutEffect, useMemo, useRef } from 'react';
import { CatmullRomCurve3, Color, InstancedMesh, Object3D, Vector3 } from 'three';

function Bowl({ level, color }: { level: number; color: string }) {
  const mesh = useRef<InstancedMesh>(null);
  const tiers = level === 5 ? 3 : 2;
  const rows = level === 5 ? 13 : 10;
  const segments = 96;
  const count = tiers * rows * segments;
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    let index = 0;
    for (let tier = 0; tier < tiers; tier++)
      for (let row = 0; row < rows; row++)
        for (let segment = 0; segment < segments; segment++) {
          const angle = (segment / segments) * Math.PI * 2;
          const distance = tier * 10 + row * 0.88;
          const x = 51 + distance,
            z = 73 + distance;
          dummy.position.set(Math.cos(angle) * x, 1 + tier * 12 + row * 0.65, Math.sin(angle) * z);
          dummy.rotation.set(0, -Math.atan2(z * Math.cos(angle), -x * Math.sin(angle)), 0);
          dummy.scale.set(
            (Math.hypot(x * Math.sin(angle), z * Math.cos(angle)) * Math.PI * 2) / segments + 0.12,
            1.1,
            1.4,
          );
          dummy.updateMatrix();
          mesh.current.setMatrixAt(index, dummy.matrix);
          mesh.current.setColorAt(
            index++,
            new Color(
              segment % 12 === 0
                ? '#e9e6d7'
                : level === 5
                  ? tier % 2
                    ? '#3c5364'
                    : '#5c7180'
                  : color,
            ),
          );
        }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [count, color, dummy, level, rows, tiers]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  );
}

export function ModernArena({ level, color }: { level: number; color: string }) {
  const monumental = level === 5;
  const outerX = monumental ? 88 : 75,
    outerZ = monumental ? 110 : 99;
  const height = monumental ? 40 : 27;
  const rib = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, -height / 2, 0),
        new Vector3(3, -height * 0.15, 0),
        new Vector3(1, height * 0.3, 0),
        new Vector3(-5, height / 2, 0),
      ]),
    [height],
  );
  return (
    <group>
      <mesh position={[0, -0.1, 0]} scale={[outerX + 7, 1, outerZ + 7]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.12, 96]} />
        <meshStandardMaterial color="#a7aaa0" />
      </mesh>
      <Bowl level={level} color={color} />
      <mesh position={[0, height / 2 - 1, 0]} scale={[outerX - 1.5, 1, outerZ - 1.5]} castShadow>
        <cylinderGeometry args={[1, 1, height - 2, 96, 1, true]} />
        <meshStandardMaterial
          color={monumental ? '#536978' : '#456360'}
          metalness={0.5}
          roughness={0.4}
          side={2}
        />
      </mesh>
      {monumental &&
        Array.from({ length: 17 }, (_, index) => (
          <mesh
            key={index}
            position={[0, 2 + index * 2.15, 0]}
            scale={[outerX + 0.4, 1, outerZ + 0.4]}
          >
            <cylinderGeometry args={[1, 1, 0.65, 96, 1, true]} />
            <meshStandardMaterial color="#b8c3c8" metalness={0.6} roughness={0.4} side={2} />
          </mesh>
        ))}
      <mesh
        position={[0, height, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[outerX, outerZ, 1]}
        castShadow
      >
        <ringGeometry args={[monumental ? 0.88 : 0.72, 1.04, 96]} />
        <meshStandardMaterial
          color={monumental ? '#a6b2ba' : '#eee8db'}
          side={2}
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>
      {Array.from({ length: monumental ? 80 : 56 }, (_, index) => {
        const angle = (index / (monumental ? 80 : 56)) * Math.PI * 2;
        return (
          <group
            key={index}
            position={[Math.cos(angle) * outerX, height / 2, Math.sin(angle) * outerZ]}
            rotation={[0, -angle, 0]}
          >
            <mesh castShadow>
              {monumental ? (
                <boxGeometry args={[1.1, height, 3]} />
              ) : (
                <tubeGeometry args={[rib, 16, 1.3, 6, false]} />
              )}
              <meshStandardMaterial
                color={monumental ? '#84949f' : '#f1ebdf'}
                metalness={0.25}
                roughness={0.55}
              />
            </mesh>
          </group>
        );
      })}
      {[0, Math.PI].map((angle) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * (outerX - 2), height - 6, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <boxGeometry args={[18, 6, 0.7]} />
          <meshStandardMaterial color="#132b36" emissive="#35647b" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function TraditionalDetails({ level, color }: { level: number; color: string }) {
  return (
    <group>
      {level >= 2 &&
        [-1, 1].map((side) => (
          <group key={side} position={[side * 55, 0, 0]}>
            <mesh position={[0, level === 3 ? 8 : 3, 0]} castShadow>
              <boxGeometry args={[5, level === 3 ? 16 : 6, 112]} />
              <meshStandardMaterial color="#e5e2d5" />
            </mesh>
            {Array.from({ length: 14 }, (_, index) => (
              <mesh key={index} position={[side * 2.6, level === 3 ? 9 : 3.4, -50 + index * 7.6]}>
                <boxGeometry args={[0.15, 1.8, 4]} />
                <meshStandardMaterial color="#345563" metalness={0.3} />
              </mesh>
            ))}
            {level === 3 && (
              <mesh position={[0, 17, 0]}>
                <boxGeometry args={[6, 1.4, 114]} />
                <meshStandardMaterial color={color} />
              </mesh>
            )}
          </group>
        ))}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}${z}`} position={[x * 51, 0, z * 72]}>
            <mesh position={[0, level * 4 + 7, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.65, level * 8 + 14, 6]} />
              <meshStandardMaterial color="#8b9998" />
            </mesh>
            <mesh position={[0, level * 8 + 14, 0]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[level * 2 + 3, level + 1, 0.8]} />
              <meshStandardMaterial color="#f4edcc" emissive="#fff0bc" emissiveIntensity={0.3} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
