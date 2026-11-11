import type { Fixture, MatchResult, WorldState } from '@football/shared';

/** Called only for a newly completed fixture, within its persisted match transaction. */
export function settleMatchDiscipline(
  state: WorldState,
  fixture: Fixture,
  result: MatchResult,
): WorldState {
  const previous = state.discipline?.competitions[fixture.competitionId] ?? {};
  const records = { ...previous };
  let changed = false;
  for (const [id, record] of Object.entries(previous)) {
    const clubId = state.players.byId[id]?.clubId;
    if (record.suspendedGames > 0 && (clubId === fixture.homeId || clubId === fixture.awayId)) {
      records[id] = { ...record, suspendedGames: record.suspendedGames - 1 };
      changed = true;
    }
  }
  const cards = new Map<string, { yellows: number; red: boolean }>();
  const appeared = new Set([
    ...(result.lineups?.home ?? []),
    ...(result.lineups?.away ?? []),
    ...(result.substitutions ?? []).map((s) => s.in),
  ]);
  for (const action of result.actions ?? []) {
    if (
      !action.playerId ||
      !appeared.has(action.playerId) ||
      (action.type !== 'yellow' && action.type !== 'red')
    )
      continue;
    const record = cards.get(action.playerId) ?? { yellows: 0, red: false };
    if (action.type === 'red') record.red = true;
    else record.yellows++;
    cards.set(action.playerId, record);
  }
  for (const [id, cardsInMatch] of cards) {
    const previous = records[id] ?? { yellowCards: 0, suspendedGames: 0 };
    // A dismissal already produces one suspension; this match's yellows do not double it.
    const yellows = previous.yellowCards + (cardsInMatch.red ? 0 : cardsInMatch.yellows);
    records[id] = {
      yellowCards: yellows % 3,
      suspendedGames: Math.max(previous.suspendedGames, cardsInMatch.red || yellows >= 3 ? 1 : 0),
    };
    changed = true;
  }
  if (!changed) return state;
  return {
    ...state,
    discipline: {
      version: 1,
      competitions: {
        ...state.discipline?.competitions,
        [fixture.competitionId]: records,
      },
    },
  };
}
