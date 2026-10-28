import { DoubleSide } from 'three';

// World-space mist starts at the last city blocks, independent of camera distance.
// The central stadium, training campus and inhabited streets remain clear.
export function GroundMist() {
  return (
    <mesh
      name="Névoa nas bordas vazias da cidade"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.22, 0]}
      renderOrder={2}
    >
      <planeGeometry args={[2400, 2400]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
        vertexShader={`
          varying vec2 groundPosition;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            groundPosition = world.xz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          varying vec2 groundPosition;
          void main() {
            vec2 edge = abs(groundPosition - vec2(20.0, 10.0)) - vec2(430.0, 405.0);
            float distanceToCity = max(edge.x, edge.y);
            float mist = smoothstep(-10.0, 85.0, distanceToCity);
            gl_FragColor = vec4(vec3(0.776, 0.812, 0.796), mist);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}
