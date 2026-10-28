import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

export function Pitch({ level }: { level: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 680;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível desenhar o gramado');
    ctx.fillStyle = level <= 2 ? '#617744' : level === 3 ? '#458249' : '#287e43';
    ctx.fillRect(0, 0, 680, 1050);
    let seed = 71;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (level <= 3) {
      for (let index = 0; index < 700; index++) {
        const x = random() * 680,
          y = random() * 1050;
        ctx.fillStyle = ['#93a65c', '#39723d', '#5f934f', '#75964f'][index % 4] ?? '#4b8143';
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + random() * 50, 5 + random() * 32, random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (level <= 2) {
      ctx.globalAlpha = 0.8;
      for (let index = 0; index < (level === 1 ? 115 : 28); index++) {
        const x = random() * 680,
          y = random() * 1050;
        const width = 9 + random() * (level === 1 ? 55 : 24),
          height = 6 + random() * 30;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(random() * 3);
        ctx.scale(width, height);
        const soil = ctx.createRadialGradient(0, 0, 0.15, 0, 0, 1);
        soil.addColorStop(0, index % 3 ? '#a08459' : '#796344');
        soil.addColorStop(0.6, '#9b8055bb');
        soil.addColorStop(1, '#9b805500');
        ctx.fillStyle = soil;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (level === 5)
      for (let stripe = 0; stripe < 20; stripe++) {
        ctx.fillStyle = stripe % 2 ? '#328e4b' : '#23783d';
        ctx.fillRect(0, stripe * 52.5, 680, 52.5);
      }
    ctx.strokeStyle = level <= 2 ? '#e7dfc3' : '#f3f3e7';
    ctx.lineWidth = level <= 2 ? 2 : 2.5;
    ctx.strokeRect(5, 5, 670, 1040);
    ctx.beginPath();
    ctx.moveTo(5, 525);
    ctx.lineTo(675, 525);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(340, 525, 91.5, 0, Math.PI * 2);
    ctx.stroke();
    for (const end of [0, 1]) {
      ctx.strokeRect(138.5, end ? 880 : 5, 403, 165);
      ctx.strokeRect(248.5, end ? 990 : 5, 183, 55);
      ctx.beginPath();
      ctx.arc(340, end ? 935 : 115, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        340,
        end ? 935 : 115,
        91.5,
        end ? Math.PI * 1.2 : 0.2 * Math.PI,
        end ? Math.PI * 1.8 : 0.8 * Math.PI,
      );
      ctx.stroke();
    }
    const value = new CanvasTexture(canvas);
    value.colorSpace = SRGBColorSpace;
    value.anisotropy = 8;
    return value;
  }, [level]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} receiveShadow>
      <planeGeometry args={[68, 105]} />
      <meshStandardMaterial
        map={texture}
        roughness={1}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
