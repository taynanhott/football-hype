/** Repair neutral seams once per frame, before caching it for different club kits. */
export function repairNewsArtMaterials(base: ImageData, map: ImageData): ImageData {
  const repaired = new ImageData(new Uint8ClampedArray(map.data), map.width, map.height);
  for (let i = 0; i < map.data.length; i += 4) {
    if (map.data[i]) continue;
    const r = base.data[i]!,
      g = base.data[i + 1]!,
      b = base.data[i + 2]!;
    // Only neutral fabric/outline gaps qualify; grass and skin retain their colors.
    if (Math.max(r, g, b) - Math.min(r, g, b) >= 32 || Math.min(r, g, b) <= 65) continue;
    const x = (i / 4) % map.width,
      y = Math.floor(i / 4 / map.width);
    search: for (let radius = 1; radius <= 2; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (x + dx < 0 || x + dx >= map.width || y + dy < 0 || y + dy >= map.height) continue;
          const j = ((y + dy) * map.width + x + dx) * 4;
          if (!map.data[j] || map.data[j + 1]! <= 100) continue;
          repaired.data[i] = map.data[j]!;
          repaired.data[i + 1] = Math.round((r + g + b) / 3);
          repaired.data[i + 2] = 255;
          break search;
        }
      }
    }
  }
  return repaired;
}
