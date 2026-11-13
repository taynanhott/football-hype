import type { RefObject } from 'react';
import type { Group, Mesh } from 'three';
import type { ClubKit, illustratedAppearance } from '@football/shared';

import { playerBuild } from './player-build';

type Joint = RefObject<Group | null>;
type Appearance = ReturnType<typeof illustratedAppearance>;

// Low segment counts keep the rounded silhouettes inexpensive at match-camera distances.
function Oval({
  position,
  scale,
  color,
  meshRef,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  meshRef?: RefObject<Mesh | null>;
}) {
  return (
    <mesh ref={meshRef ?? null} position={position} scale={scale} castShadow>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color={color} roughness={0.88} />
    </mesh>
  );
}

function Hair({ appearance, variant }: { appearance: Appearance; variant: number }) {
  const { hairStyle: style, hairColor: color } = appearance;
  if (style === 'bald') return null;
  return (
    <group>
      <mesh position={[0, 2.44, -0.015]} scale={[1, style === 'curly' ? 1.3 : 0.78, 1]}>
        <sphereGeometry args={[0.265, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {style === 'short' && (
        <Oval
          position={[0.025, 2.62, 0.055]}
          scale={[0.21, 0.065 + variant * 0.018, 0.16]}
          color={color}
        />
      )}
      {style === 'curly' &&
        Array.from({ length: 7 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 7;
          return (
            <Oval
              key={i}
              position={[Math.cos(angle) * 0.17, 2.59 + (i % 2) * 0.035, Math.sin(angle) * 0.16]}
              scale={[0.115, 0.12, 0.115]}
              color={color}
            />
          );
        })}
      {style === 'long' && (
        <>
          <Oval position={[0, 2.38, -0.14]} scale={[0.27, 0.32, 0.18]} color={color} />
          <Oval
            position={[0, 2.24, -0.32]}
            scale={[0.105, 0.23 + variant * 0.025, 0.11]}
            color={color}
          />
        </>
      )}
      {style === 'braids' &&
        [-2, -1, 0, 1, 2].map((i) => (
          <group key={i}>
            <Oval
              position={[i * 0.09, 2.61 - Math.abs(i) * 0.025, -0.02]}
              scale={[0.042, 0.055, 0.235]}
              color={color}
            />
            <Oval position={[i * 0.085, 2.37, -0.235]} scale={[0.04, 0.22, 0.045]} color={color} />
          </group>
        ))}
    </group>
  );
}

export function PlayerFigure({
  kit,
  appearance,
  build,
  keeper,
  leftArm,
  rightArm,
  leftLeg,
  rightLeg,
  leftKnee,
  rightKnee,
  leftBoot,
  rightBoot,
}: {
  kit: ClubKit;
  appearance: Appearance;
  build: ReturnType<typeof playerBuild>;
  keeper: boolean;
  leftArm: Joint;
  rightArm: Joint;
  leftLeg: Joint;
  rightLeg: Joint;
  leftKnee: Joint;
  rightKnee: Joint;
  leftBoot: RefObject<Mesh | null>;
  rightBoot: RefObject<Mesh | null>;
}) {
  const shirt = keeper ? (kit.tertiary ?? kit.secondary) : kit.primary;
  const skin = appearance.skinTone;
  return (
    <group position={[0, -1.5, 0]}>
      <group scale={[build.headWidth, 1, 1]}>
        <Oval position={[0, 2.41, 0]} scale={[0.245, 0.24, 0.225]} color={skin} />
        <Oval position={[0, 2.28, 0.025]} scale={[0.2 * build.jaw, 0.15, 0.19]} color={skin} />
        {[-1, 1].map((side) => (
          <Oval
            key={side}
            position={[side * 0.24, 2.39, 0]}
            scale={[0.045, 0.07, 0.045]}
            color={skin}
          />
        ))}
        <Oval position={[0, 2.38, 0.223]} scale={[0.045, 0.065, 0.055]} color={skin} />
        <Hair appearance={appearance} variant={build.hair} />
        {appearance.beardStyle !== 'none' && (
          <Oval
            position={[0, 2.255, 0.075]}
            scale={[0.202 * build.jaw, appearance.beardStyle === 'full' ? 0.14 : 0.075, 0.166]}
            color={appearance.hairColor}
          />
        )}
      </group>
      <Oval position={[0, 2.15, 0]} scale={[0.12, 0.19, 0.12]} color={skin} />
      <mesh position={[0, 1.75, 0]} scale={[1, 1, 0.62]} castShadow>
        <capsuleGeometry args={[0.4, 0.3, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.9} />
      </mesh>
      {/* Patterns follow the rounded shirt surface, with no intersecting boxes. */}
      {!keeper &&
        [-1, 1].map((face) => (
          <group key={face}>
            {(kit.pattern === 'stripes' || kit.pattern === 'hoops') &&
              [-1, 0, 1].map((i) => (
                <mesh
                  key={i}
                  position={[0, 1.75 + (kit.pattern === 'hoops' ? i * 0.13 : 0), 0]}
                  scale={[1.01, 1.01, 0.63]}
                >
                  {kit.pattern === 'stripes' ? (
                    <cylinderGeometry
                      args={[
                        0.4,
                        0.4,
                        0.44,
                        4,
                        1,
                        true,
                        (face === 1 ? 0 : Math.PI) + i * 0.48 - 0.12,
                        0.24,
                      ]}
                    />
                  ) : (
                    <cylinderGeometry
                      args={[
                        0.4,
                        0.4,
                        0.07,
                        10,
                        1,
                        true,
                        face === 1 ? -Math.PI / 2 : Math.PI / 2,
                        Math.PI,
                      ]}
                    />
                  )}
                  <meshStandardMaterial
                    color={kit.tertiary && i === 0 ? kit.tertiary : kit.secondary}
                    roughness={0.9}
                  />
                </mesh>
              ))}
            {kit.pattern === 'sash' && (
              <mesh position={[0, 1.76, face * 0.25]} rotation={[0, 0, -0.6]}>
                <planeGeometry args={[0.1, 0.65]} />
                <meshStandardMaterial color={kit.secondary} side={2} roughness={0.9} />
              </mesh>
            )}
          </group>
        ))}
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.39, 2.01, 0]}>
          <Oval position={[side * 0.025, -0.12, 0]} scale={[0.155, 0.22, 0.16]} color={shirt} />
          <mesh position={[0, -0.34, 0]} castShadow>
            <capsuleGeometry args={[0.105, 0.3, 3, 8]} />
            <meshStandardMaterial color={keeper ? shirt : skin} roughness={0.9} />
          </mesh>
          <group position={[0, -0.55, 0]} rotation={[-0.35, 0, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.23, 3, 8]} />
              <meshStandardMaterial color={keeper ? shirt : skin} roughness={0.9} />
            </mesh>
            <Oval
              position={[0, -0.345, 0]}
              scale={keeper ? [0.13, 0.16, 0.085] : [0.08, 0.12, 0.065]}
              color={keeper ? '#e9efbf' : skin}
            />
          </group>
        </group>
      ))}
      <Oval position={[0, 1.19, 0]} scale={[0.35, 0.23, 0.235]} color={kit.secondary} />
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.19, 1.2, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.16, 0.2, 3, 8]} />
            <meshStandardMaterial color={kit.secondary} roughness={0.9} />
          </mesh>
          <Oval position={[0, -0.39, 0]} scale={[0.125, 0.23, 0.13]} color={skin} />
          <group ref={side < 0 ? leftKnee : rightKnee} position={[0, -0.6, 0]}>
            <mesh position={[0, -0.21, 0]} castShadow>
              <capsuleGeometry args={[0.105, 0.28, 3, 8]} />
              <meshStandardMaterial color={kit.secondary} roughness={0.9} />
            </mesh>
            <Oval
              meshRef={side < 0 ? leftBoot : rightBoot}
              position={[0, -0.5, 0.085]}
              scale={[0.12, 0.1, 0.225]}
              color="#182323"
            />
          </group>
        </group>
      ))}
    </group>
  );
}
