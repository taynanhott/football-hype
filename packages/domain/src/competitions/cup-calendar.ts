import { COMPETITIONS, knockoutLegs, type CupNode, type WorldState } from '@football/shared';
import { competitionDates } from './season-calendar.js';

/** Calendar reservations only: these nodes are never eligible for simulation. */
export function cupCalendarNodes(state: WorldState): CupNode[] {
  const nodes = [...state.cups];
  for (const rule of COMPETITIONS.filter((rule) => rule.groupSize)) {
    if (nodes.some((node) => node.competitionId === rule.id)) continue;
    const fixtures = state.fixtures.filter((f) => f.competitionId === rule.id && f.group);
    if (!fixtures.length) continue;
    const groupCount = new Set(fixtures.map((f) => f.group)).size;
    const rounds = Math.log2(groupCount * 2);
    if (!Number.isInteger(rounds)) continue;
    const dates = competitionDates(rule.id, state.season, rounds, true);
    for (let round = 0; round < rounds; round++) {
      nodes.push({
        id: `reserved:${rule.id}:${round}`,
        competitionId: rule.id,
        round,
        scheduledAt: dates[round]!,
        legs: knockoutLegs(rule.id, round, rounds - 1),
        homeId: null,
        awayId: null,
        leftId: null,
        rightId: null,
        winnerId: null,
        label:
          rounds - round === 1
            ? 'Final'
            : rounds - round === 2
              ? 'Semifinal'
              : rounds - round === 3
                ? 'Quartas de final'
                : 'Oitavas de final',
      });
    }
  }
  return nodes;
}

export function cupPhaseLabel(round: number, lastRound: number) {
  return (
    ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final', 'Dezesseis avos'][
      lastRound - round
    ] ?? `Fase ${round + 1}`
  );
}
