import { useEffect, useRef } from 'react';
import type { ClubKit } from '@football/shared';
const loadImage = async (src: string) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
};
let assets: Promise<HTMLImageElement[]> | undefined;
const bases = new Map<number, { base: ImageData; map: ImageData }>();
const renders = new Map<string, ImageData>();
/** Each material pixel is authored once. Runtime never classifies scene colors. */
export function NewsActionArt({
  variant,
  homeKit,
  awayKit,
}: {
  variant: number;
  homeKit: ClubKit;
  awayKit: ClubKit;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const homePrimary = homeKit.primary,
    homeSecondary = homeKit.secondary,
    awayPrimary = awayKit.primary,
    awaySecondary = awayKit.secondary;
  useEffect(() => {
    let active = true;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const key = [variant, homePrimary, homeSecondary, awayPrimary, awaySecondary].join(':');
    const draw = async () => {
      const cached = renders.get(key);
      if (cached) {
        ctx.putImageData(cached, 0, 0);
        return;
      }
      let template = bases.get(variant);
      if (!template) {
        assets ??= Promise.all([
          loadImage('/images/news/actions-v4.webp'),
          loadImage('/images/news/actions-v4-materials.png'),
        ]);
        const images = await assets;
        const frames = images.map((img) => {
          const c = document.createElement('canvas');
          c.width = c.height = 512;
          const brush = c.getContext('2d')!;
          brush.imageSmoothingEnabled = false;
          brush.drawImage(
            img,
            ((variant % 3) * img.width) / 3,
            (Math.floor(variant / 3) * img.height) / 2,
            img.width / 3,
            img.height / 2,
            0,
            0,
            512,
            512,
          );
          return brush.getImageData(0, 0, 512, 512);
        });
        template = { base: frames[0]!, map: frames[1]! };
        bases.set(variant, template);
      }
      if (!active) return;
      const out = new ImageData(new Uint8ClampedArray(template.base.data), 512, 512);
      const colors = [homePrimary, homeSecondary, awayPrimary, awaySecondary].map((hex) =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
      );
      for (let i = 0; i < out.data.length; i += 4) {
        const material = Math.round(template.map.data[i]! / 50);
        if (!material) continue;
        const shade = template.map.data[i + 1]! / 255;
        // The neutral atlas is white: blending it into dark kits leaves pale seams.
        // Material pixels already carry the authored edge shading in the green channel.
        const coverage = 1;
        const color = colors[material - 1]!;
        for (let c = 0; c < 3; c++)
          out.data[i + c] = Math.round(
            color[c]! * shade * coverage + template.base.data[i + c]! * (1 - coverage),
          );
      }
      if (renders.size >= 12) renders.delete(renders.keys().next().value!);
      renders.set(key, out);
      ctx.putImageData(out, 0, 0);
    };
    void draw().catch(() => {
      assets = undefined;
    });
    return () => {
      active = false;
    };
  }, [variant, homePrimary, homeSecondary, awayPrimary, awaySecondary]);
  return (
    <canvas
      ref={ref}
      width={512}
      height={512}
      className="news-action-canvas"
      role="img"
      aria-label="Ilustração de futebol com uniformes nas cores dos clubes"
    />
  );
}
