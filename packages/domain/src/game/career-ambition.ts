import type { ClubSnapshot, PlayerSnapshot, WorldState } from '@football/shared';
import { clubResults } from './history-index.js';
export const divisionStrength = (club: ClubSnapshot) =>
  club.leagueStrength ?? { A: 80, B: 65, C: 50, D: 35, REGIONAL: 30 }[club.division];
export function careerAmbition(state: WorldState, player: PlayerSnapshot) {
  const club = state.clubs.byId[player.clubId ?? ''];
  if (!club || player.age >= 32 || state.management?.loans?.[player.id]) return 0;
  const signedAt = state.management?.contractHistory?.[player.id]?.signedAt || state.createdAt;
  if (state.lastProcessedAt - signedAt < 180 * 86400000) return 0;
  const recent = clubResults(state, club.id).slice(-10);
  const points = recent.reduce((sum, game) => {
    const diff =
      game.homeId === club.id ? game.homeGoals - game.awayGoals : game.awayGoals - game.homeGoals;
    return sum + (diff > 0 ? 3 : diff === 0 ? 1 : 0);
  }, 0);
  const project = recent.length >= 6 && points / recent.length >= 2 ? 8 : 0;
  const coaching = state.centers.byId[club.trainingCenterId]?.levels.coaching ?? 1;
  return Math.max(
    0,
    Math.min(100, (player.overall - divisionStrength(club) - 12 - project - (coaching - 1)) * 5),
  );
}
