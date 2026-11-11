import {
  EUROPEAN_LEAGUES,
  EUROPEAN_COUNTRIES,
  type ClubSnapshot,
  type EuropeanLeagues,
  type Fixture,
  type MatchResult,
  type WorldState,
} from '@football/shared';
import { roundRobin } from './round-robin.js';
import { competitionDates } from './season-calendar.js';
import { standings } from './standings.js';
import { hashSeed, mulberry32 } from '../simulation/random.js';

type League = EuropeanLeagues['leagues'][number];
const scheduleCache = new WeakMap<League, Map<number, Fixture[]>>();
const viewCache = new WeakMap<League, Map<number, ReturnType<typeof buildView>>>();
const tieBreakers = ['points', 'wins', 'goalDifference', 'goalsFor', 'id'] as const;

/** Game dates, deliberately independent from the real-world European season. */
export function europeanRoundDate(season: number, round: number): number {
  return competitionDates('serie-a', season, 38)[round]!;
}

export function createEuropeanLeagues(
  clubs: readonly ClubSnapshot[],
  season: number,
): EuropeanLeagues {
  return {
    season,
    leagues: EUROPEAN_LEAGUES.flatMap((rule) => {
      const selected = rule.clubs.map((name) =>
        clubs.find((club) => club.country === rule.country && club.name === name),
      );
      // Missing configured clubs are never silently replaced or invented.
      if (selected.some((club) => !club || club.playerIds.length < 11)) return [];
      return [
        {
          competitionId: rule.id,
          scheduleVersion: 2 as const,
          clubIds: selected.map((club) => club!.id),
          scores: [],
        },
      ];
    }),
  };
}

export function europeanFixtures(league: League, season: number): Fixture[] {
  // Persisted scores are indexed by this v1 pairing order. Any future scheduling
  // change must retain a v1 reconstruction path for existing seasons/archives.
  let years = scheduleCache.get(league);
  if (!years) {
    years = new Map();
    scheduleCache.set(league, years);
  }
  const cached = years.get(season);
  if (cached) return cached;
  const pairs = roundRobin(league.clubIds, 2);
  const fixtures = pairs.ok
    ? pairs.value.map((pair): Fixture => ({
        ...pair,
        id: `${league.competitionId}:${season}:${pair.round}:${pair.homeId}`,
        competitionId: league.competitionId,
        scheduledAt:
          (league.roundDates
            ? Date.UTC(season, 0, 1, 19) + league.roundDates[pair.round]! * 86400000
            : undefined) ??
          (league.scheduleVersion === 2
            ? europeanRoundDate(season, pair.round)
            : Date.UTC(season, 0, 28, 19) + Math.round((pair.round * 289) / 37) * 86400000),
      }))
    : [];
  years.set(season, fixtures);
  return fixtures;
}

function buildView(league: League, season: number) {
  const fixtures = europeanFixtures(league, season);
  const results: MatchResult[] = fixtures.flatMap((fixture, index) => {
    const score = league.scores[fixture.round]?.[index % 10];
    return score
      ? [
          {
            fixtureId: fixture.id,
            homeId: fixture.homeId,
            awayId: fixture.awayId,
            homeGoals: score[0],
            awayGoals: score[1],
            status: 'finished',
            attendance: 0,
            revenue: 0,
            seed: 0,
            scorers: [],
          },
        ]
      : [];
  });
  return { fixtures, results, table: standings(league.clubIds, fixtures, results, tieBreakers) };
}

export function europeanLeagueView(league: League, season: number) {
  let years = viewCache.get(league);
  if (!years) {
    years = new Map();
    viewCache.set(league, years);
  }
  let view = years.get(season);
  if (!view) {
    view = buildView(league, season);
    years.set(season, view);
  }
  return view;
}

function squadStrength(
  state: WorldState,
  id: string,
  players: WorldState['players']['byId'],
): number {
  const club = state.clubs.byId[id];
  const squad = (club?.playerIds ?? [])
    .flatMap((pid) => (players[pid] ? [players[pid]!] : []))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 11);
  return squad.length
    ? squad.reduce((sum, p) => sum + p.overall + (p.morale - 50) * 0.03, 0) / squad.length
    : 40;
}

/** Bounded Poisson sampling; no athlete actions, ratings, finances or replay. */
export function summaryScore(
  homeStrength: number,
  awayStrength: number,
  seed: number,
): [number, number] {
  const random = mulberry32(seed);
  const goals = (mean: number) => {
    const limit = Math.exp(-mean);
    let product = random(),
      score = 0;
    while (product > limit && score < 12) {
      score++;
      product *= random();
    }
    return score;
  };
  const gap = Math.max(-30, Math.min(30, homeStrength - awayStrength));
  return [goals(Math.max(0.3, 1.45 + gap * 0.035)), goals(Math.max(0.3, 1.12 - gap * 0.035))];
}

/** Runs only with existing calendar advances. Repeated/reconnected advances are no-ops. */
export function advanceEuropeanLeagues(
  state: WorldState,
  target: number,
  players = state.players.byId,
): WorldState {
  const europe = state.europeanLeagues;
  if (!europe || europe.season !== state.season) return state;
  let changed = false;
  const nationalDates = new Map<number, number>();
  for (const fixture of state.fixtures) {
    if (fixture.competitionId === 'serie-a') nationalDates.set(fixture.round, fixture.scheduledAt);
  }
  const leagues = europe.leagues.map((original) => {
    const oldDates = europeanFixtures(original, europe.season);
    const roundDates = Array.from({ length: 38 }, (_, round) =>
      round < original.scores.length
        ? oldDates[round * 10]!.scheduledAt
        : (nationalDates.get(round) ?? europeanRoundDate(europe.season, round)),
    );
    const datesChanged = roundDates.some(
      (date, round) => date !== oldDates[round * 10]!.scheduledAt,
    );
    const league = datesChanged
      ? {
          ...original,
          roundDates: roundDates.map(
            (date) => (date - Date.UTC(europe.season, 0, 1, 19)) / 86400000,
          ),
        }
      : original;
    if (datesChanged) changed = true;
    if (league.scores.length === 38 || roundDates[league.scores.length]! > target) return league;
    const fixtures = europeanFixtures(league, europe.season);
    const strengths = new Map(league.clubIds.map((id) => [id, squadStrength(state, id, players)]));
    const scores = [...league.scores];
    for (let round = scores.length; round < 38 && roundDates[round]! <= target; round++) {
      scores.push(
        fixtures
          .slice(round * 10, round * 10 + 10)
          .map((fixture) =>
            summaryScore(
              strengths.get(fixture.homeId)!,
              strengths.get(fixture.awayId)!,
              hashSeed(state.seed, `${state.season}:${fixture.id}`),
            ),
          ),
      );
    }
    changed = true;
    return { ...league, scores };
  });
  return changed ? { ...state, europeanLeagues: { ...europe, leagues } } : state;
}

export function europeanQualifiers(europe: EuropeanLeagues | undefined): string[] | undefined {
  if (
    !europe ||
    europe.leagues.length !== 5 ||
    europe.leagues.some((league) => league.scores.length !== 38)
  )
    return undefined;
  return europe.leagues.flatMap((league) =>
    europeanLeagueView(league, europe.season)
      .table.slice(0, 4)
      .map((row) => row.id),
  );
}

const initialSeeds = [
  'Manchester City',
  'Arsenal',
  'Liverpool',
  'Chelsea',
  'Paris Saint-Germain',
  'Monaco',
  'Olympique Marseille',
  'LOSC Lille',
  'Bayern Munich',
  'Bayer 04 Leverkusen',
  'Borussia Dortmund',
  'RB Leipzig',
  'Real Madrid',
  'Barcelona',
  'Atlético de Madrid',
  'Athletic Bilbao',
  'Inter Milan',
  'Napoli',
  'Juventus',
  'Atalanta BC',
];

export function championsParticipants(
  clubs: readonly ClubSnapshot[],
  season: number,
  qualified?: readonly string[],
): string[] {
  const available = new Set(
    clubs.filter((club) => club.playerIds.length >= 11).map((club) => club.id),
  );
  const main = qualified
    ? [...qualified]
    : initialSeeds.flatMap((name) => {
        const club = clubs.find((club) => club.name === name);
        return club ? [club.id] : [];
      });
  if (main.length !== 20 || new Set(main).size !== 20 || main.some((id) => !available.has(id)))
    return [];
  const countries = new Set<string>(EUROPEAN_COUNTRIES);
  const major = new Set<string>(EUROPEAN_LEAGUES.map((rule) => rule.country));
  const pool = clubs
    .filter(
      (club) => countries.has(club.country) && !major.has(club.country) && available.has(club.id),
    )
    .map((club) => club.id)
    .sort();
  const offset = pool.length ? (Math.max(0, season - 2026) * 12) % pool.length : 0;
  return [...main, ...pool.slice(offset), ...pool.slice(0, offset)].slice(0, 32);
}

/** Sporting pressure is capped and scaled by matches played, avoiding opening-round extremes. */
export function europeanTransferPressure(state: WorldState, clubId: string | undefined): number {
  const europe = state.europeanLeagues;
  const league = europe?.leagues.find((league) => clubId && league.clubIds.includes(clubId));
  if (!europe || !league || league.scores.length < 5) return 0;
  const table = europeanLeagueView(league, europe.season).table;
  const position = table.findIndex((row) => row.id === clubId) + 1;
  return Math.round(
    (position <= 4 ? -8 : position >= 15 ? 8 : position >= 10 ? 3 : 0) *
      Math.min(1, league.scores.length / 12),
  );
}
