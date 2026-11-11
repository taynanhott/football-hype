import type { PlayerSnapshot } from '@football/shared';

export function scoutingReport(
  player: Pick<PlayerSnapshot, 'id' | 'clubId' | 'academyClubId' | 'overall' | 'potential'>,
  ownClubId: string | undefined,
  scoutLevel: number,
  ownedLoan = false,
) {
  const own = Boolean(
    ownClubId &&
    (player.clubId === ownClubId ||
      (player.clubId === null && player.academyClubId === ownClubId) ||
      ownedLoan),
  );
  const level = Number.isFinite(scoutLevel) ? Math.max(1, Math.min(5, Math.floor(scoutLevel))) : 1;
  const hidden = !own && level === 1;
  // Stable per player, with independently varying margins at each scout level.
  let seed = 2166136261;
  for (const character of player.id) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const draw = (count: number) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed % count;
  };
  let below = 4 + draw(7);
  let above = 1 + draw(below - 1);
  // Build outward from the best report so upgrades always narrow the interval.
  for (let reportLevel = 4; reportLevel >= level; reportLevel--) {
    below += 2 + draw(6);
    above = Math.min(below - 1, above + draw(5));
  }
  if (own) below = above = 0;
  const minimum = hidden ? null : Math.max(player.overall, player.potential - below);
  const upperMargin = Math.max(0, player.potential - (minimum ?? player.potential) - 1);
  const maximum = hidden ? null : Math.min(99, player.potential + Math.min(above, upperMargin));
  return {
    overall: hidden ? ('?' as const) : player.overall,
    potential: hidden ? '?' : own ? String(player.potential) : minimum + '–' + maximum,
    minimum,
    maximum,
    hidden,
    tier: hidden
      ? 'unknown'
      : player.overall <= 69
        ? 'bronze'
        : player.overall <= 77
          ? 'silver'
          : player.overall <= 85
            ? 'gold'
            : 'diamond',
  };
}
