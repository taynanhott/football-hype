/* eslint-disable react-hooks/immutability -- GPU animation uniforms are mutable. */
/* eslint-disable react-hooks/set-state-in-effect -- Anchors require the mounted stadium geometry. */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three';
import { clubCrest, type ClubSnapshot } from '@football/shared';
import { badgeShapes, badgeSymbols } from '../ui/badge-art';
import { crowdBoxClearance, clearCrowdSeats } from './crowd-clearance';
import { visitorCrowdSeat } from './flare-layout';
import { crowdNoise, occupiedCrowdSeats, type CrowdSeat } from './stadium-seating';

export type FlagClub = Pick<ClubSnapshot, 'name' | 'abbreviation' | 'kit' | 'crest'>;
function flagTexture(club: FlagClub) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const crest = clubCrest(club);
  ctx.fillStyle = crest.primary;
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = crest.secondary;
  ctx.fillRect(0, 35, 512, 48);
  ctx.fillRect(0, 237, 512, 48);
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath();
  ctx.ellipse(256, 160, 112, 133, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(156, 60);
  ctx.scale(3.125, 3.125);
  const shape = new Path2D(badgeShapes[crest.shape]);
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = crest.primary;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = crest.secondary;
  if (crest.pattern === 'stripes') for (const x of [12, 26, 40, 54]) ctx.fillRect(x, 3, 7, 59);
  if (crest.pattern === 'hoops') for (const y of [13, 27, 41, 55]) ctx.fillRect(3, y, 58, 7);
  if (crest.pattern === 'split') ctx.fillRect(32, 0, 32, 64);
  if (crest.pattern === 'quarters') {
    ctx.fillRect(32, 0, 32, 32);
    ctx.fillRect(0, 32, 32, 32);
  }
  if (crest.pattern === 'cross') {
    ctx.fillRect(26, 0, 12, 64);
    ctx.fillRect(0, 26, 64, 12);
  }
  if (crest.pattern === 'sash') ctx.fill(new Path2D('M0 54L54 0H64V10L10 64H0Z'));
  ctx.fillStyle = crest.primary;
  ctx.fillRect(13, 20, 38, 26);
  const rgb = parseInt(crest.primary.slice(1), 16);
  ctx.fillStyle =
    (rgb >> 16) * 0.299 + ((rgb >> 8) & 255) * 0.587 + (rgb & 255) * 0.114 > 150
      ? '#15191d'
      : '#fff8e8';
  if (crest.symbol === 'monogram') {
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(crest.initials, 32, 38);
  } else {
    if (crest.symbol === 'cross' && /vasco/i.test(club.name)) ctx.fillStyle = '#df3042';
    ctx.fill(new Path2D(badgeSymbols[crest.symbol] ?? ''), 'evenodd');
  }
  ctx.restore();
  ctx.strokeStyle = crest.accent;
  ctx.lineWidth = 3;
  ctx.stroke(shape);
  ctx.restore();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Flag({
  seat,
  texture,
  phase,
}: {
  seat: CrowdSeat;
  texture: CanvasTexture;
  phase: number;
}) {
  const uniforms = useMemo(
    () => ({ time: { value: phase }, cloth: { value: texture } }),
    [texture, phase],
  );
  useFrame(({ clock }) => {
    uniforms.time.value = clock.elapsedTime + phase;
  });
  return (
    <group position={[seat.x, seat.y - 0.425, seat.z]} rotation={[0, seat.rotation, 0]}>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 4.8, 5]} />
        <meshStandardMaterial color="#c9cbcb" />
      </mesh>
      <mesh position={[1.6, 3.65, 0]}>
        <planeGeometry args={[3.2, 2.1, 16, 8]} />
        <shaderMaterial
          side={DoubleSide}
          uniforms={uniforms}
          vertexShader={`uniform float time; varying vec2 flagUv; void main(){flagUv=uv;vec3 p=position;p.z+=(sin(uv.x*8.0-time*2.8+uv.y*2.0)*0.27+sin(uv.x*15.0-time*4.1)*0.09)*uv.x;p.y+=sin(uv.x*6.0-time*2.0)*0.1*uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`}
          fragmentShader={`uniform sampler2D cloth;varying vec2 flagUv;void main(){gl_FragColor=texture2D(cloth,flagUv);
#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`}
        />
      </mesh>
    </group>
  );
}

export function CrowdFlags({
  seats,
  occupancy,
  home,
  away,
}: {
  seats: readonly CrowdSeat[] | null;
  occupancy: number;
  home: FlagClub;
  away: FlagClub;
}) {
  const scene = useThree((s) => s.scene),
    compact = useThree((s) => s.size.width < 900);
  const textures = useMemo(() => [flagTexture(home), flagTexture(away)], [home, away]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  const [positions, setPositions] = useState<CrowdSeat[]>([]);
  useLayoutEffect(() => {
    const root = scene.getObjectByName('stadium-structure');
    if (!root || !seats) return;
    const safe = clearCrowdSeats(root, seats),
      occupied = occupiedCrowdSeats(safe, occupancy),
      clear = crowdBoxClearance(root);
    const chosen: CrowdSeat[] = [];
    const candidates = safe
      .filter((_, i) => occupied[i])
      .sort(
        (a, b) =>
          crowdNoise(a.x * 177 + a.z * 331 + a.y * 19) -
          crowdNoise(b.x * 177 + b.z * 331 + b.y * 19),
      );
    for (const visitor of [false, true])
      for (const seat of candidates) {
        if (chosen.filter((s) => visitorCrowdSeat(s) === visitor).length >= (compact ? 2 : 4))
          break;
        if (
          visitorCrowdSeat(seat) !== visitor ||
          chosen.some((s) => Math.hypot(s.x - seat.x, s.z - seat.z) < 17)
        )
          continue;
        const cloth = {
          ...seat,
          x: seat.x + Math.cos(seat.rotation) * 1.6,
          z: seat.z - Math.sin(seat.rotation) * 1.6,
        };
        if (clear(seat, 1.1, 4.85, 0.12) && clear(cloth, 2.4, 4.85, 1.8)) chosen.push(seat);
      }
    setPositions(chosen);
  }, [scene, seats, occupancy, compact]);
  return (
    <group name="Bandeiras das torcidas">
      {positions.map((seat, i) => (
        <Flag
          key={i}
          seat={seat}
          phase={i * 7.31}
          texture={textures[visitorCrowdSeat(seat) ? 1 : 0]!}
        />
      ))}
    </group>
  );
}
