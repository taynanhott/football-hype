import { cupReturnDate } from './season-calendar.js';
import { COMPETITIONS, type Fixture, type WorldState } from '@football/shared';

/** Includes both legs of known cup ties, including completed games. */
export function scheduledFixtures(state: WorldState): Fixture[] {
  const cups = state.cups.flatMap((node): Fixture[] => {
    if (!node.homeId || !node.awayId) return [];
    const rule = COMPETITIONS.find((item) => item.id === node.competitionId);
    const twoLegs = (node.legs ?? rule?.legs) === 2;
    const first: Fixture = {
      id: twoLegs ? `${node.id}:first` : node.id,
      competitionId: node.competitionId,
      round: node.round,
      homeId: node.homeId,
      awayId: node.awayId,
      scheduledAt: node.scheduledAt,
      ...(node.neutral ? { neutral: true } : {}),
      ...(node.stadiumId ? { stadiumId: node.stadiumId } : {}),
    };
    return twoLegs
      ? [
          first,
          {
            ...first,
            id: node.id,
            homeId: node.awayId,
            awayId: node.homeId,
            scheduledAt: cupReturnDate(node.competitionId, node.scheduledAt),
          },
        ]
      : [first];
  });
  return [
    ...new Map([...state.fixtures, ...cups].map((fixture) => [fixture.id, fixture])).values(),
  ].sort((a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id));
}
