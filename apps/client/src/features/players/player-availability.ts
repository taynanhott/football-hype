import { GAMEPLAY, type ClubSnapshot, type WorldState } from '@football/shared';
import {
  isFifaWindow,
  medicallyAvailable,
  playerAvailable,
  playerSuspension,
  clubAvailabilityAt,
} from '@football/domain';
import { clubCalendarFixtures } from '../competitions/club-calendar-fixtures';

export { clubAvailabilityAt };
export function clubCallupActive(state: WorldState, club: ClubSnapshot) {
  return isFifaWindow(clubAvailabilityAt(state, club));
}

export function clubUnavailablePlayers(state: WorldState, club: ClubSnapshot) {
  const at = clubAvailabilityAt(state, club);
  return club.playerIds.flatMap((id) => {
    const player = state.players.byId[id];
    return player && !playerAvailable(state, id, at) ? [player] : [];
  });
}

/** Forecast only known club fixtures; medical treatment may bring recovery forward. */
export function clubAvailabilityReturns(state: WorldState, club: ClubSnapshot) {
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const fixtures = clubCalendarFixtures(state, club.id).filter(
    (fixture) => !completed.has(fixture.id),
  );
  const callupAt = clubAvailabilityAt(state, club);
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
    { games: number; at: number | null; calledUp: boolean; injured: boolean; suspended: boolean }
  >();
  for (const id of club.playerIds) {
    const player = state.players.byId[id];
    if (!player) continue;
    const injured = !medicallyAvailable(state, id);
    const calledUp = Boolean(window && player.overall >= 80);
    const suspendedGames = playerSuspension(state, id, fixtures[0]?.competitionId);
    const suspended = suspendedGames > 0;
    if (!injured && !calledUp && !suspended) continue;
    const recoveryRate = center?.operations?.medical.includes(id) ? 2 : 1;
    const missedGames = injured ? Math.ceil((state.injuries[id] ?? 0) / recoveryRate) : 0;
    const finalMissedFixture = fixtures[missedGames - 1];
    const recoveryAt = missedGames
      ? finalMissedFixture
        ? finalMissedFixture.scheduledAt + 1
        : null
      : 0;
    const suspensionFixture = fixtures.filter(
      (f) => f.competitionId === fixtures[0]?.competitionId,
    )[suspendedGames - 1];
    const suspensionAt = suspended
      ? suspensionFixture
        ? suspensionFixture.scheduledAt + 1
        : null
      : 0;
    const at =
      recoveryAt === null || suspensionAt === null
        ? null
        : Math.max(recoveryAt, calledUp ? callupReturn : 0, suspensionAt);
    returns.set(id, {
      games: Math.max(
        missedGames,
        suspendedGames,
        fixtures.filter((fixture) =>
          at !== null ? fixture.scheduledAt < at : calledUp && fixture.scheduledAt < callupReturn,
        ).length,
      ),
      at,
      calledUp,
      injured,
      suspended,
    });
  }
  return returns;
}
