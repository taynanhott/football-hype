import measured from './player-looks.json' with { type: 'json' };
import type { PlayerSnapshot } from '../types/snapshots.js';
/** Stable fictional illustrations; never inferred from nationality or name. */
export function illustratedAppearance(id: string): PlayerSnapshot['appearance'] {
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const pick = <T>(values: readonly T[]) => values[next() % values.length]!;
  return {
    skinTone: pick(['#f1d0b0', '#e6b890', '#cd986e', '#b67d55', '#936244', '#70482f', '#513626']),
    hairColor: pick(['#211b19', '#4b3023', '#775037', '#ad7e40', '#d5bd7d', '#898780']),
    hairStyle: pick(['short', 'curly', 'bald', 'braids', 'long'] as const),
    beardStyle: pick(['none', 'none', 'stubble', 'full'] as const),
  };
}
/** Resolve only records tied to the imported source ID; retain generated details where unspecified. */
export function importedAppearance(id: string): PlayerSnapshot['appearance'] {
  const fallback = illustratedAppearance(id);
  if (!id.startsWith('00000020-')) return fallback;
  const sourceId = String(parseInt(id.slice(-12), 16));
  const row = (measured.players as Record<string, (number | string)[]>)[sourceId];
  if (!row) return fallback;
  const [skin, hair, beard, bald, style] = row;
  const hairStyle =
    bald === 1
      ? 'bald'
      : style === 'curly' || style === 'afro'
        ? 'curly'
        : style === 'twists' || style === 'braids'
          ? 'braids'
          : style === 'long'
            ? 'long'
            : style
              ? 'short'
              : fallback.hairStyle === 'bald'
                ? 'short'
                : fallback.hairStyle;
  return {
    skinTone: measured.skin[Number(skin)] ?? fallback.skinTone,
    hairColor: measured.hair[Number(hair)] ?? fallback.hairColor,
    hairStyle,
    beardStyle:
      beard === 9 ? fallback.beardStyle : beard === 2 ? 'full' : beard === 1 ? 'stubble' : 'none',
  };
}
export function portraitAppearance(player: Pick<PlayerSnapshot, 'id' | 'appearance'>) {
  // Namespace 32 identifies players from the supplied HTML dataset.
  return player.id.startsWith('00000020-') ? importedAppearance(player.id) : player.appearance;
}
