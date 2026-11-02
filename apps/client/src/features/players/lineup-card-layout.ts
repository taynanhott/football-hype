import type { Formation } from '@football/shared';
// Visual lines from the supplied references, ordered from attack to goalkeeper.
const referenceLines: Record<Formation, readonly number[]> = {
  '4-4-2': [3, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0],
  '4-3-3': [3, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0],
  '4-2-3-1': [4, 3, 3, 3, 3, 2, 2, 1, 1, 1, 0],
  '4-1-4-1': [4, 3, 3, 3, 3, 2, 1, 1, 1, 1, 0],
  '4-4-1-1': [4, 3, 3, 3, 3, 2, 2, 2, 2, 1, 0],
  '4-3-1-2': [4, 3, 3, 3, 3, 2, 2, 2, 1, 0, 0],
  '4-2-2-2': [4, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0],
  '4-3-3-offensive': [4, 3, 3, 3, 3, 2, 2, 1, 0, 0, 0],
  '4-2-4': [3, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0],
  '4-5-1': [4, 3, 3, 3, 3, 1, 2, 1, 2, 1, 0],
  '3-5-2': [4, 3, 3, 3, 1, 2, 2, 1, 1, 0, 0],
  '3-4-3': [3, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0],
  '3-2-4-1': [4, 3, 3, 3, 2, 2, 1, 1, 1, 1, 0],
  '5-3-2': [4, 2, 3, 3, 3, 2, 1, 1, 1, 0, 0],
  '5-4-1': [4, 2, 3, 3, 3, 2, 1, 1, 1, 1, 0],
};
/** Preserve reference lines and sides; adapt only distances to the existing pitch. */
export function layoutLineupCards<T extends { x: number; y: number }>(
  entries: readonly T[],
  width: number,
  height: number,
  cardWidth: number,
  cardHeight: number,
  formation: Formation,
) {
  if (!entries.length) return [];
  const lines = referenceLines[formation];
  const count = Math.max(...lines) + 1;
  const horizontalInset = width > 380 ? width * 0.03 + 6 : 5;
  const left = cardWidth / 2 + horizontalInset,
    right = width - left;
  const top = cardHeight / 2 + 17,
    bottom = height - cardHeight / 2 - 5;
  const gap = Math.max(0, Math.min(7, (width - horizontalInset * 2 - 4 * cardWidth) / 3));
  const step = Math.max(cardWidth + gap, (right - left) / 4);
  const stagger = Math.max(
    0,
    Math.min(24, (height - 22 - count * cardHeight - (count - 1) * 10) / count),
  );
  const spacing = (bottom - top - stagger) / (count - 1);
  return entries.map((entry, index) => {
    const line = lines[index]!;
    const peers = entries.filter((_, i) => lines[i] === line);
    const first = Math.min(...peers.map((p) => p.y)),
      last = Math.max(...peers.map((p) => p.y));
    const offset =
      (last === first ? 0 : ((entry.y - first) / (last - first)) * stagger) +
      (formation === '5-3-2' && index === 7 ? 48 : 0);
    let x: number;
    if (entry.x <= 15) x = left;
    else if (entry.x <= 30) x = width / 2 - step;
    else if (entry.x < 50) x = width / 2 - step / 2;
    else if (entry.x === 50) x = width / 2;
    else if (entry.x < 70) x = width / 2 + step / 2;
    else if (entry.x < 85) x = width / 2 + step;
    else x = right;
    return { ...entry, x: (x / width) * 100, y: ((top + line * spacing + offset) / height) * 100 };
  });
}
