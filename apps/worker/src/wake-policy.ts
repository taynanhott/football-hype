import { gameDayStart, GAME_DAY_MS, pendingFixtures } from '@football/domain';
import { MATCH_DURATION_MS, type WorldState } from '@football/shared';

export function leagueWakePlan(state: WorldState) {
  return {
    active: !state.deletedAt && state.status === 'active',
    nextScheduledAt: state.nextScheduledAt,
    playingUntil: Math.max(
      0,
      ...state.results
        .filter((result) =>
          state.participants.some((p) => p.clubId === result.homeId || p.clubId === result.awayId),
        )
        .map((result) => (result.startedAt ?? 0) + MATCH_DURATION_MS),
    ),
    calendarAnchor: state.calendarAnchor,
    fixtureAt: pendingFixtures(state)[0]?.scheduledAt,
    seasonClock: Boolean(state.seasonClock),
    lastProcessedAt: state.lastProcessedAt,
    targets: [
      ...(state.competitionDraws ?? []).map((d) => d.scheduledAt),
      ...Object.values(state.centers.byId).flatMap((c) =>
        (c.operations?.individual ?? []).map((p) => p.endsAt),
      ),
    ],
  };
}
export function nextPlannedWake(
  state: ReturnType<typeof leagueWakePlan>,
  now: number,
): number | undefined {
  if (!state.active) return undefined;
  let next = state.nextScheduledAt;
  if (next <= now) return Math.max(now + 1000, state.playingUntil);
  const matchAt = next;
  const anchor = state.calendarAnchor;
  const fixtureAt = state.fixtureAt;
  if (!state.seasonClock || !anchor || !fixtureAt || fixtureAt <= anchor.gameAt) return next;
  const gameAt = (realAt: number) =>
    anchor.gameAt +
    ((realAt - anchor.realAt) * (fixtureAt - anchor.gameAt)) / (matchAt - anchor.realAt);
  const current = Math.max(state.lastProcessedAt, gameAt(now));
  const targets = [
    gameDayStart(current) + GAME_DAY_MS,
    ...state.targets.filter((at) => at > current),
  ];
  for (const target of targets) {
    const realAt =
      anchor.realAt +
      ((target - anchor.gameAt) * (matchAt - anchor.realAt)) / (fixtureAt - anchor.gameAt);
    if (realAt > now) next = Math.min(next, Math.ceil(realAt));
  }
  return next;
}
/** Wake at a real game event, never to poll an unchanged world. */
export function nextLeagueWake(state: WorldState, now: number): number | undefined {
  return nextPlannedWake(leagueWakePlan(state), now);
}
