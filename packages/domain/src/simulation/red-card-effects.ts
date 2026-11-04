import type { MatchResult } from '@football/shared';
/** Relative numerical disadvantage. These are game parameters, not empirical probabilities. */
export function redCardEffects(
  ownPlayers: number,
  opposingPlayers: number,
  shortHandedMinutes: number,
) {
  const deficit = Math.max(0, opposingPlayers - ownPlayers);
  const elapsed = Math.min(1, Math.max(0, shortHandedMinutes) / 90);
  return {
    attack: Math.max(0.4, 1 - deficit * (0.18 + elapsed * 0.12)),
    exposure: Math.min(2, 1 + deficit * (0.3 + elapsed * 0.25)),
    movement: Math.max(0.85, 1 - Math.max(0, 11 - ownPlayers) * elapsed * 0.08),
  };
}
export function redCardFatigueFactor(
  playerId: string,
  side: 'home' | 'away',
  entered: number,
  played: number,
  actions: MatchResult['actions'],
) {
  if (played <= 0 || !actions?.length) return 1;
  const exposure = (actions ?? []).reduce(
    (sum, action) =>
      sum +
      (action.type === 'red' && action.side === side && action.playerId !== playerId
        ? Math.max(0, entered + played - Math.max(entered, action.minute))
        : 0),
    0,
  );
  return 1 + Math.min(1, (0.25 * exposure) / played);
}
