import { cupGroupTables, standings } from '@football/domain';
import { COMPETITIONS, type GameSnapshot, type WorldState } from '@football/shared';

let previous: Pick<WorldState, 'fixtures' | 'results' | 'clubs' | 'cups'> | undefined;
let tables: GameSnapshot['tables'] = {};
/** Derived standings are computed once on this machine, not once per connected player on the server. */
export function localTables(state: WorldState): GameSnapshot['tables'] {
  if (
    previous &&
    previous.fixtures === state.fixtures &&
    previous.results === state.results &&
    previous.clubs === state.clubs &&
    previous.cups === state.cups
  )
    return tables;
  tables = Object.fromEntries(
    COMPETITIONS.filter((r) => r.format === 'league').map((rule) => [
      rule.id,
      [
        ...standings(
          state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === rule.division),
          state.fixtures.filter((f) => f.competitionId === rule.id && !f.group),
          state.results,
          rule.tieBreakers,
        ),
      ],
    ]),
  );
  for (const rule of COMPETITIONS.filter((r) => r.groupSize || r.id === 'serie-c'))
    for (const group of cupGroupTables(state, rule.id))
      tables[`${rule.id}:group:${group.group}`] = [...group.table];
  previous = state;
  return tables;
}
