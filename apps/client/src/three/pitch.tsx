import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { PITCH_SURFACE_Y } from './pitch-surface';

export function Pitch({ level }: { level: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 680;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível desenhar o gramado');
    // Continuous spatial noise avoids stamped circles and concentrates wear in busy areas.
    const hash = (x: number, y: number) => {
      let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + 71;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const noise = (x: number, y: number) => {
      const ix = Math.floor(x),
        iy = Math.floor(y);
      const fx = x - ix,
        fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy);
      return (
        (hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx) * (1 - sy) +
        (hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx) * sy
      );
    };
    const smooth = (low: number, high: number, value: number) => {
      const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
      return t * t * (3 - 2 * t);
    };
    const condition = Math.max(1, Math.min(5, level));
    const damage = [0, 1, 0.62, 0.26, 0.06, 0][condition] ?? 0;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const broad = noise(x / 75, y / 85);
        const detail = noise(x / 15, y / 19);
        const fine = noise(x / 4, y / 7);
        const goalTraffic =
          Math.exp(-(((x - 340) / 105) ** 2)) *
          (Math.exp(-(((y - 28) / 90) ** 2)) + Math.exp(-(((y - 1022) / 90) ** 2)));
        const midfieldTraffic = Math.exp(-(((x - 340) / 145) ** 2) - ((y - 525) / 190) ** 2);
        const traffic = Math.min(1, goalTraffic + midfieldTraffic * 0.45);
        const soil =
          smooth(0.56, 0.77, broad * 0.48 + detail * 0.34 + fine * 0.18 + traffic * 0.23) * damage;
        const dry = smooth(0.3, 0.75, broad * 0.7 + detail * 0.3 + traffic * 0.15) * damage;
        const stripe =
          condition >= 3 ? ((Math.floor(y / 52.5) % 2 ? 4 : -4) * (condition - 2)) / 3 : 0;
        const variation = (broad - 0.5) * 13 + (hash(x, y) - 0.5) * 15 + (fine - 0.5) * 12 + stripe;
        const grass = [49 + dry * 40, 119 - dry * 9, 58 - dry * 17];
        const earth = [119 + detail * 23, 99 + detail * 18, 65 + detail * 13];
        const offset = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          pixels.data[offset + channel] =
            grass[channel]! * (1 - soil) + earth[channel]! * soil + variation;
        }
        pixels.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PITCH_SURFACE_Y, 0]} receiveShadow>
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
