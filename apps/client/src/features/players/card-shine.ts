import type { CSSProperties } from 'react';
const sessionSeed = Math.random() * 100000;
/** Stable per player during this session, staggered across visible cards. */
export function cardShineStyle(id: string): CSSProperties {
  let seed = sessionSeed | 0;
  for (const char of id) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
  return {
    '--card-shine-period': `${5 + (seed % 6)}s`,
    '--card-shine-delay': `${-(seed % 1000) / 100}s`,
  } as CSSProperties;
}
