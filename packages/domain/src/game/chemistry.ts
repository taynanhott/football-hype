import { TACTICS, type MatchResult } from '@football/shared';

/** Chemistry is stored in match units; percentage changes must also clamp legacy totals. */
export function changeChemistry(current: number, percentagePoints: number) {
  const maximum = TACTICS.chemistryMatches;
  return Math.max(
    0,
    Math.min(maximum, Math.min(maximum, Math.max(0, current)) + (maximum * percentagePoints) / 100),
  );
}

export function hasNoMatchSequence(games: readonly MatchResult[], playerId: string) {
  return (
    games.length >= 6 &&
    games
      .slice(-6)
      .every(
        (result) =>
          !result.lineups?.home.includes(playerId) &&
          !result.lineups?.away.includes(playerId) &&
          !(result.minutesPlayed?.[playerId] ?? 0) &&
          !result.substitutions?.some((sub) => sub.in === playerId),
      )
  );
}
