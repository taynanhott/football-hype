import { isSerieC2026, type ClubSnapshot, type WorldState } from '@football/shared';
import { seasonSchedule } from './world-factory.js';

export function correctSerieC2026(clubs: WorldState['clubs']): WorldState['clubs'] {
  const hasOfficialClubs = Object.values(clubs.byId).some((club) => isSerieC2026(club.name));
  if (!hasOfficialClubs) return clubs;
  return {
    ...clubs,
    byId: Object.fromEntries(
      Object.entries(clubs.byId).map(([id, club]): [string, ClubSnapshot] => [
        id,
        club.country === 'BR' && isSerieC2026(club.name)
          ? { ...club, division: 'C', leagueStrength: 55 }
          : club,
      ]),
    ),
  };
}

/** Restart sporting records only; retain the manager's squad, transfers and facilities. */
export function resetSeasonCompetitions(state: WorldState, now: number): WorldState {
  const clubs = state.season === 2026 ? correctSerieC2026(state.clubs) : state.clubs;
  const schedule = seasonSchedule(Object.values(clubs.byId), now);
  const played = new Map<string, number>();
  for (const row of state.ratingHistory.filter((row) => row.season === state.season))
    played.set(row.playerId, (played.get(row.playerId) ?? 0) + 1);
  return {
    ...state,
    ...schedule,
    clubs,
    players: {
      ...state.players,
      byId: Object.fromEntries(
        Object.entries(state.players.byId).map(([id, player]) => [
          id,
          {
            ...player,
            appearances: Math.max(0, player.appearances - (played.get(id) ?? 0)),
            fitness: 100,
          },
        ]),
      ),
    },
    round: 0,
    results: [],
    status: 'active',
    lastProcessedAt: now,
    participants: state.participants.map((member) => ({ ...member, ready: false })),
    ratingHistory: state.ratingHistory.filter((row) => row.season !== state.season),
    trophies: state.trophies.filter((row) => row.season !== state.season),
    workload: {},
    chemistry: {},
    injuries: {},
  };
}
