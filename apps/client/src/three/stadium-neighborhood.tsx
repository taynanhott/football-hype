import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { createCityLayout, type CityPart } from './city-layout';
function CityBatch({
  parts,
  shape = 'box',
}: {
  parts: CityPart[];
  shape?: 'box' | 'roof' | 'window' | 'tree' | 'trunk';
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D(),
      colors = new Map<string, Color>();
    parts.forEach((part, index) => {
      object.position.set(...part.position);
      object.scale.set(...part.scale);
      object.rotation.set(0, part.rotation ?? 0, 0);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      let color = colors.get(part.color);
      if (!color) {
        color = new Color(part.color);
        colors.set(part.color, color);
      }
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts]);
  if (!parts.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} receiveShadow>
      {shape === 'roof' ? (
        <coneGeometry args={[1, 1, 4]} />
      ) : shape === 'window' ? (
        <planeGeometry args={[1, 1]} />
      ) : shape === 'tree' ? (
        <icosahedronGeometry args={[1, 1]} />
      ) : shape === 'trunk' ? (
        <cylinderGeometry args={[1, 1, 1, 5]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      <meshStandardMaterial
        roughness={shape === 'window' ? 0.36 : 0.9}
        metalness={shape === 'window' ? 0.15 : 0}
      />
    </instancedMesh>
  );
}
export function StadiumNeighborhood({ seed }: { seed: number }) {
  const city = useMemo(() => createCityLayout(seed), [seed]);
  return (
    <group name="Bairro do estádio">
      <CityBatch parts={city.boxes} />
      <CityBatch parts={city.roofs} shape="roof" />
      <CityBatch parts={city.windows} shape="window" />
      <CityBatch parts={city.trunks} shape="trunk" />
      <CityBatch parts={city.canopies} shape="tree" />
    </group>
  );
}
