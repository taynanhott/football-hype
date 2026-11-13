/** Cosmetic variation is stable across playback, substitutions and reconnections. */
export function playerBuild(id: string) {
  let seed = 2166136261;
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return {
    height: (1.75 + (seed % 18) / 100) / 1.855,
    width: 0.94 + ((seed >>> 8) % 13) / 100,
    headWidth: 0.9 + ((seed >>> 16) % 20) / 100,
    jaw: 0.86 + ((seed >>> 20) % 22) / 100,
    hair: (seed >>> 12) % 3,
  };
}
