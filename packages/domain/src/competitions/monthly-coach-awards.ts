import { COMPETITIONS, type WorldState } from '@football/shared';
import { BRAZIL_LEAGUE_STRENGTH } from '../market/interest.js';
import { scheduledFixtures } from './fixtures.js';

type Award = NonNullable<WorldState['monthlyCoachAwards']>[number];
const OFFSET = 10_800_000;

/** National award: completed official games, weighted by the club's Brazilian division.
 * Score = weighted points percentage × games / (games + 2); at least 3 games.
 * No money, gala, polling, or replay of already awarded months.
 */
export function finalizeMonthlyCoachAward(state: WorldState, boundary: number): WorldState {
  const date = new Date(boundary - OFFSET);
  if (date.getUTCMonth() === 0 || date.getUTCDate() !== 1 || date.getUTCHours() !== 0) return state;
  const month = new Date(boundary - OFFSET - 1).toISOString().slice(0, 7);
  if (state.monthlyCoachAwards?.some((a) => a.season === state.season && a.month === month))
    return state;
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1, 3);
  const fixtures = new Map(scheduledFixtures(state).map((f) => [f.id, f]));
  const competitions = new Map(COMPETITIONS.map((c) => [c.id, c]));
  const coaches = new Map<
    string,
    Award & { weightedPoints: number; goalDifference: number; latestAt: number }
  >();
  const seen = new Set<string>();
  for (const result of state.results) {
    const fixture = fixtures.get(result.fixtureId);
    if (
      !fixture ||
      seen.has(fixture.id) ||
      result.status !== 'finished' ||
      fixture.scheduledAt < start ||
      fixture.scheduledAt >= boundary ||
      !competitions.has(fixture.competitionId)
    )
      continue;
    seen.add(fixture.id);
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ? fixture.homeId : fixture.awayId;
      const club = state.clubs.byId[clubId];
      if (!club || club.country !== 'BR') continue;
      const coachUserId = result.coachUserIds?.[side];
      const key = coachUserId ? `user:${coachUserId}` : `club:${clubId}`;
      const stats = coaches.get(key) ?? {
        season: state.season,
        month,
        awardedAt: boundary,
        ...(coachUserId ? { coachUserId } : {}),
        coachName: '',
        clubId,
        clubName: club.name,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        score: 0,
        weightedPoints: 0,
        goalDifference: 0,
        latestAt: 0,
      };
      if (fixture.scheduledAt >= stats.latestAt) {
        stats.latestAt = fixture.scheduledAt;
        stats.clubId = clubId;
        stats.clubName = club.name;
        stats.coachName =
          (coachUserId
            ? state.participants.find((p) => p.userId === coachUserId)?.coach?.name
            : club.coachName) || `Treinador do ${club.name}`;
      }
      const goals = side === 'home' ? result.homeGoals : result.awayGoals;
      const conceded = side === 'home' ? result.awayGoals : result.homeGoals;
      const won = goals > conceded,
        drawn = goals === conceded;
      const division = competitions.get(fixture.competitionId)?.division ?? club.division;
      const weight = BRAZIL_LEAGUE_STRENGTH[division];
      stats.games++;
      stats.wins += Number(won);
      stats.draws += Number(drawn);
      stats.losses += Number(!won && !drawn);
      stats.goalDifference += goals - conceded;
      stats.weightedPoints += (won ? 3 : drawn ? 1 : 0) * weight;
      coaches.set(key, stats);
    }
  }
  const winner = [...coaches.entries()]
    .filter(([, c]) => c.games >= 3 && c.weightedPoints > 0)
    .map(([id, c]) => ({ id, ...c, score: c.weightedPoints / (3 * (c.games + 2)) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.wins - a.wins ||
        b.goalDifference - a.goalDifference ||
        a.id.localeCompare(b.id),
    )[0];
  if (!winner) return state;
  const award: Award = {
    season: winner.season,
    month: winner.month,
    awardedAt: winner.awardedAt,
    ...(winner.coachUserId ? { coachUserId: winner.coachUserId } : {}),
    coachName: winner.coachName,
    clubId: winner.clubId,
    clubName: winner.clubName,
    score: winner.score,
    games: winner.games,
    wins: winner.wins,
    draws: winner.draws,
    losses: winner.losses,
  };
  return { ...state, monthlyCoachAwards: [...(state.monthlyCoachAwards ?? []), award] };
}
