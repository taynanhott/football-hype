import type { PlayerSnapshot } from '@football/shared';

export function scoutingReport(
  player: Pick<PlayerSnapshot, 'clubId' | 'academyClubId' | 'overall' | 'potential'>,
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
  const margin = own ? 0 : (6 - level) * 4;
  const minimum = hidden ? null : Math.max(1, player.potential - margin);
  const maximum = hidden ? null : Math.min(99, player.potential + margin);
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
