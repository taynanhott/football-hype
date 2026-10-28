import type { WorldState } from '@football/shared';
import { standings } from './standings.js';
import { roundRobin } from './round-robin.js';
import { calendarDates } from './calendar.js';
import { cupGroupTables } from './cup-groups.js';

export function progressSerieC(state: WorldState): WorldState {
  const first = state.fixtures.filter((f) => f.competitionId === 'serie-c' && !f.group);
  const done = new Set(state.results.map((r) => r.fixtureId));
  if (!first.length || first.some((f) => !done.has(f.id))) return state;
  const second = state.fixtures.filter((f) => f.competitionId === 'serie-c' && f.group);
  if (!second.length) {
    const ids = [...new Set(first.flatMap((f) => [f.homeId, f.awayId]))];
    const table = standings(ids, first, state.results);
    if (table.length < 8) return state;
    const dates = calendarDates(Math.max(...first.map((f) => f.scheduledAt)), 6);
    const fixtures = [
      [0, 3, 4, 7],
      [1, 2, 5, 6],
    ].flatMap((seeds, index) => {
      const group = index === 0 ? 'B' : 'C';
      const matches = roundRobin(
        seeds.map((seed) => table[seed]!.id),
        2,
      );
      return matches.ok
        ? matches.value.map((match) => ({
            ...match,
            group,
            competitionId: 'serie-c',
            id: `serie-c:group:${group}:${match.round}:${match.homeId}`,
            scheduledAt: dates[match.round]!,
          }))
        : [];
    });
    return { ...state, fixtures: [...state.fixtures, ...fixtures] };
  }
  if (second.some((f) => !done.has(f.id)) || state.cups.some((n) => n.competitionId === 'serie-c'))
    return state;
  const groups = cupGroupTables(state, 'serie-c');
  if (groups.length !== 2) return state;
  return {
    ...state,
    cups: [
      ...state.cups,
      {
        id: 'serie-c:final',
        competitionId: 'serie-c',
        round: 0,
        homeId: groups[0]!.table[0]!.id,
        awayId: groups[1]!.table[0]!.id,
        leftId: null,
        rightId: null,
        winnerId: null,
        legs: 2,
        label: 'Final',
        scheduledAt: calendarDates(Math.max(...second.map((f) => f.scheduledAt)), 1)[0]!,
      },
    ],
  };
}
