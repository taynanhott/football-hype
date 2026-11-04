import { GAMEPLAY, type ClubSnapshot, type WorldState } from '@football/shared';
import { isFifaWindow, medicallyAvailable } from '@football/domain';
import { clubCalendarFixtures } from '../competitions/club-calendar-fixtures';

export function clubAvailabilityAt(state: WorldState, club: ClubSnapshot) {
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const next = clubCalendarFixtures(state, club.id)
    .filter((fixture) => !completed.has(fixture.id))
    .reduce((at, fixture) => Math.min(at, fixture.scheduledAt), Infinity);
  return isFifaWindow(state.lastProcessedAt)
    ? state.lastProcessedAt
    : Number.isFinite(next)
      ? next
      : state.nextScheduledAt;
}
export function clubCallupActive(state: WorldState, club: ClubSnapshot) {
  return isFifaWindow(clubAvailabilityAt(state, club));
}

export function clubUnavailablePlayers(state: WorldState, club: ClubSnapshot) {
  const callups = clubCallupActive(state, club);
  return club.playerIds.flatMap((id) => {
    const player = state.players.byId[id];
    return player && (!medicallyAvailable(state, id) || (callups && player.overall >= 80))
      ? [player]
      : [];
  });
}

/** Forecast only known club fixtures; medical treatment may bring recovery forward. */
export function clubAvailabilityReturns(state: WorldState, club: ClubSnapshot) {
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const fixtures = clubCalendarFixtures(state, club.id).filter(
    (fixture) => !completed.has(fixture.id),
  );
  const next = Math.min(...fixtures.map((fixture) => fixture.scheduledAt));
  const callupAt = isFifaWindow(state.lastProcessedAt)
    ? state.lastProcessedAt
    : Number.isFinite(next)
      ? next
      : state.nextScheduledAt;
  const day = new Date(callupAt - 10800000).toISOString().slice(0, 10);
  const window = GAMEPLAY.fifaWindows.find(
    (item) => day.slice(5) >= item.start.slice(5) && day.slice(5) <= item.end.slice(5),
  );
  const callupReturn = window
    ? Date.parse(`${day.slice(0, 4)}${window.end.slice(4)}T00:00:00-03:00`) + 86400000
    : 0;
  const center = state.centers.byId[club.trainingCenterId];
  const returns = new Map<
    string,
    { games: number; at: number | null; calledUp: boolean; injured: boolean }
  >();
  for (const id of club.playerIds) {
    const player = state.players.byId[id];
    if (!player) continue;
    const injured = !medicallyAvailable(state, id);
    const calledUp = Boolean(window && player.overall >= 80);
    if (!injured && !calledUp) continue;
    const recoveryRate = center?.operations?.medical.includes(id) ? 2 : 1;
    const missedGames = injured ? Math.ceil((state.injuries[id] ?? 0) / recoveryRate) : 0;
    const finalMissedFixture = fixtures[missedGames - 1];
    const recoveryAt = missedGames
      ? finalMissedFixture
        ? finalMissedFixture.scheduledAt + 1
        : null
      : 0;
    const at = recoveryAt === null ? null : Math.max(recoveryAt, calledUp ? callupReturn : 0);
    returns.set(id, {
      games: Math.max(
        missedGames,
        fixtures.filter((fixture) =>
          at !== null ? fixture.scheduledAt < at : calledUp && fixture.scheduledAt < callupReturn,
        ).length,
      ),
      at,
      calledUp,
      injured,
    });
  }
  return returns;
}
