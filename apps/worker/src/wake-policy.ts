import { gameDayStart, GAME_DAY_MS, pendingFixtures } from '@football/domain';
import { MATCH_DURATION_MS, type WorldState } from '@football/shared';

/** Wake at a real game event, never to poll an unchanged world. */
export function nextLeagueWake(state: WorldState, now: number): number | undefined {
  if (state.deletedAt || state.status !== 'active') return undefined;
  let next = state.nextScheduledAt;
  if (next <= now) {
    const playingUntil = Math.max(
      0,
      ...state.results
        .filter((result) =>
          state.participants.some((p) => p.clubId === result.homeId || p.clubId === result.awayId),
        )
        .map((result) => (result.startedAt ?? 0) + MATCH_DURATION_MS),
    );
    return Math.max(now + 1000, playingUntil);
  }
  const matchAt = next;
  const anchor = state.calendarAnchor;
  const fixtureAt = pendingFixtures(state)[0]?.scheduledAt;
  if (!state.seasonClock || !anchor || !fixtureAt || fixtureAt <= anchor.gameAt) return next;
  const gameAt = (realAt: number) =>
    anchor.gameAt +
    ((realAt - anchor.realAt) * (fixtureAt - anchor.gameAt)) / (matchAt - anchor.realAt);
  const current = Math.max(state.lastProcessedAt, gameAt(now));
  const targets = [
    gameDayStart(current) + GAME_DAY_MS,
    ...(state.competitionDraws ?? [])
      .filter((d) => d.scheduledAt > current)
      .map((d) => d.scheduledAt),
    ...Object.values(state.centers.byId).flatMap((c) =>
      (c.operations?.individual ?? []).filter((p) => p.endsAt > current).map((p) => p.endsAt),
    ),
  ];
  for (const target of targets) {
    const realAt =
      anchor.realAt +
      ((target - anchor.gameAt) * (matchAt - anchor.realAt)) / (fixtureAt - anchor.gameAt);
    if (realAt > now) next = Math.min(next, Math.ceil(realAt));
  }
  return next;
}
