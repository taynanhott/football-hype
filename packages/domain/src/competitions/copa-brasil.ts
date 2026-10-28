import type { CupNode } from '@football/shared';

/** CBF 2026: 28 -> 88 -> 48 -> 24 -> 32 -> 16 -> 8 -> 4 -> 2. */
export function copaBrasilBracket(
  serieA: readonly string[],
  champions: readonly string[],
  qualifiers: readonly string[],
  dates: readonly number[],
): CupNode[] {
  if (
    serieA.length !== 20 ||
    champions.length !== 4 ||
    qualifiers.length !== 102 ||
    new Set([...serieA, ...champions, ...qualifiers]).size !== 126 ||
    dates.length < 9
  )
    return [];
  type Slot = { id: string | null; parent: string | null };
  const direct = (id: string): Slot => ({ id, parent: null });
  const nodes: CupNode[] = [];
  let slots: Slot[] = qualifiers.slice(-28).map(direct);
  for (let round = 0; round < 9; round++) {
    if (round === 1) slots.push(...qualifiers.slice(0, 74).map(direct));
    if (round === 2) slots.push(...champions.map(direct));
    if (round === 4) slots.push(...serieA.map(direct));
    const next: Slot[] = [];
    for (let index = 0; index < slots.length; index += 2) {
      const home = slots[index]!,
        away = slots[index + 1]!;
      const id = `copa-brasil:${round}:${index / 2}`;
      nodes.push({
        id,
        competitionId: 'copa-brasil',
        round,
        homeId: home.id,
        awayId: away.id,
        leftId: home.parent,
        rightId: away.parent,
        winnerId: null,
        scheduledAt: dates[round]!,
        legs: round >= 4 && round <= 7 ? 2 : 1,
        label:
          round === 8
            ? 'Final'
            : round === 7
              ? 'Semifinal'
              : round === 6
                ? 'Quartas de final'
                : round === 5
                  ? 'Oitavas de final'
                  : `${round + 1}ª fase`,
      });
      next.push({ id: null, parent: id });
    }
    slots = next;
  }
  return nodes;
}
