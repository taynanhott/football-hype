import {
  DOMAIN_LIMITS,
  GAMEPLAY,
  ceilMoney,
  MONEY_STEPS,
  type PlayerSnapshot,
} from '@football/shared';

export function appearanceGrowth(
  player: PlayerSnapshot,
  coachingLevel: number,
  progress: number,
): Readonly<{ player: PlayerSnapshot; progress: number }> {
  if (
    player.age < GAMEPLAY.youthMinAge ||
    player.age > GAMEPLAY.youthMaxAge ||
    player.overall >= player.potential
  )
    return { player, progress };
  const growth =
    progress + GAMEPLAY.growthPerAppearance + coachingLevel * GAMEPLAY.coachingGrowthPerLevel;
  const overall = Math.min(player.potential, player.overall + Math.floor(growth));
  return { player: revalueGrowth(player, { ...player, overall }), progress: growth % 1 };
}
export function agePlayer(player: PlayerSnapshot, coachingLevel = 1): PlayerSnapshot {
  const declineAge =
    GAMEPLAY.declineStartAge + (player.position === 'GK' ? GAMEPLAY.goalkeeperDeclineDelay : 0);
  return {
    ...player,
    age: Math.min(DOMAIN_LIMITS.age.max, player.age + 1),
    overall: Math.max(
      DOMAIN_LIMITS.overall.min,
      player.overall -
        (player.age >= declineAge
          ? Math.max(0, GAMEPLAY.annualDecline - Math.floor((coachingLevel - 1) / 2))
          : 0),
    ),
  };
}

/** Reprice permanent improvements while preserving the player's existing market valuation. */
export function revalueGrowth(previous: PlayerSnapshot, next: PlayerSnapshot): PlayerSnapshot {
  if (next.overall <= previous.overall) return next;
  const value = Math.max(previous.marketValue.cents, MONEY_STEPS.general);
  const cents = Math.max(
    value + MONEY_STEPS.general,
    ceilMoney(value * Math.pow(1.08, next.overall - previous.overall)),
  );
  return { ...next, marketValue: { ...next.marketValue, cents } };
}
