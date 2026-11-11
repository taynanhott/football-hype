import type { WorldState } from '@football/shared';
type Award = NonNullable<WorldState['seasonAwards']>[number];
/** One persisted calculation per season. Missing match data never becomes invented performance. */
export function finalizeSeasonAwards(state: WorldState): WorldState {
  if (state.seasonAwards?.some((a) => a.season === state.season)) return state;
  const titles = new Map<string, number>();
  for (const t of state.trophies.filter((t) => t.season === state.season))
    titles.set(
      t.clubId,
      (titles.get(t.clubId) ?? 0) +
        (/europa|libertadores|intercontinental/.test(t.competitionId) ? 1 : 0.65),
    );
  const stats = new Map<
    string,
    {
      games: number;
      rating: number;
      weight: number;
      goals: number;
      assists: number;
      clean: number;
      conceded: number;
      clubId: string;
    }
  >();
  const coaches = new Map<
    string,
    { clubId: string; userId?: string; games: number; points: number }
  >();
  const fixtures = new Map([...state.fixtures, ...state.cups].map((f) => [f.id, f]));
  for (const r of state.results) {
    const f = fixtures.get(r.fixtureId);
    const home = r.homeId ?? f?.homeId,
      away = r.awayId ?? f?.awayId;
    if (!home || !away) continue;
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ? home : away,
        club = state.clubs.byId[clubId];
      if (!club) continue;
      const weight = club.country === 'BR' ? 0.72 : 1.18;
      const goals = side === 'home' ? r.homeGoals : r.awayGoals,
        conceded = side === 'home' ? r.awayGoals : r.homeGoals;
      const userId = r.coachUserIds?.[side];
      const key = userId ?? clubId;
      const c = coaches.get(key) ?? { clubId, ...(userId ? { userId } : {}), games: 0, points: 0 };
      c.games++;
      c.points += goals > conceded ? 3 : goals === conceded ? 1 : 0;
      coaches.set(key, c);
      for (const id of r.lineups?.[side] ?? []) {
        if ((r.minutesPlayed?.[id] ?? 90) < 20 || r.ratings?.[id] === undefined) continue;
        const p = stats.get(id) ?? {
          games: 0,
          rating: 0,
          weight: 0,
          goals: 0,
          assists: 0,
          clean: 0,
          conceded: 0,
          clubId,
        };
        p.games++;
        p.rating += r.ratings?.[id] ?? 6;
        p.weight += weight;
        p.goals += r.scorers.filter((g) => g.playerId === id).length;
        p.assists += r.scorers.filter((g) => g.assistId === id).length;
        p.clean += conceded === 0 ? 1 : 0;
        p.conceded += conceded;
        stats.set(id, p);
      }
    }
  }
  const eligible = [...stats]
    .filter(([, s]) => s.games >= 12)
    .flatMap(([id, s]) => {
      const p = state.players.byId[id],
        club = state.clubs.byId[s.clubId];
      if (!p || !club) return [];
      const sample = s.games / (s.games + 8),
        individual =
          (s.rating / s.games) * 7 +
          Math.min(16, ((s.goals * 0.8 + s.assists * 0.6) / s.games) * 20);
      const score =
        (individual * sample + Math.min(18, (titles.get(s.clubId) ?? 0) * 8)) *
        (s.weight / s.games);
      const keeper =
        ((s.rating / s.games) * 6 + (30 * s.clean) / s.games + 15 / (1 + s.conceded / s.games)) *
          sample +
        Math.min(15, (titles.get(s.clubId) ?? 0) * 7);
      return [
        {
          id,
          name: p.name,
          clubId: s.clubId,
          clubName: club.name,
          position: p.position,
          score,
          keeper: keeper * (s.weight / s.games),
          brazil: club.country === 'BR',
        },
      ];
    });
  const sort = (a: { score: number; id: string }, b: { score: number; id: string }) =>
    b.score - a.score || a.id.localeCompare(b.id);
  const ranked = [...eligible].sort(sort),
    br = ranked.filter((p) => p.brazil);
  const team = (pool: typeof ranked) => {
    const used = new Set<string>();
    return ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'ST', 'LW'].flatMap((pos) => {
      const p = pool.find((p) => p.position === pos && !used.has(p.id));
      if (!p) return [];
      used.add(p.id);
      return [p];
    });
  };
  const coach = [...coaches]
    .filter(([, c]) => c.games >= 12)
    .map(([id, c]) => ({
      id,
      name:
        state.participants.find((p) => p.userId === c.userId)?.coach?.name ??
        state.clubs.byId[c.clubId]?.coachName ??
        'Treinador do ' + state.clubs.byId[c.clubId]?.name,
      clubId: c.clubId,
      clubName: state.clubs.byId[c.clubId]?.name ?? '',
      position: 'Treinador',
      score:
        (c.points / (c.games * 3)) * 65 +
        (c.games / (c.games + 10)) * 15 +
        Math.min(25, (titles.get(c.clubId) ?? 0) * 12),
      ...(c.userId ? { coachUserId: c.userId } : {}),
    }))
    .sort(sort);
  const groups: [Award['category'], Award['winners']][] = [
    ['team-br', team(br)],
    ['team-world', team(ranked)],
    ['coach', coach.slice(0, 3)],
    [
      'keeper',
      eligible
        .filter((p) => p.position === 'GK')
        .map((p) => ({ ...p, score: p.keeper }))
        .sort(sort)
        .slice(0, 3),
    ],
    ['player-br', br.slice(0, 3)],
    ['player-world', ranked.slice(0, 3)],
  ];
  const awards = groups
    .filter(([, w]) => w.length)
    .map(([category, winners]) => ({
      season: state.season,
      awardedAt: state.lastProcessedAt,
      category,
      winners: winners.map(({ id, name, clubId, clubName, score, position, ...rest }) => ({
        id,
        name,
        clubId,
        clubName,
        score,
        position,
        ...('coachUserId' in rest ? { coachUserId: rest.coachUserId as string } : {}),
      })),
    }));
  return { ...state, seasonAwards: [...(state.seasonAwards ?? []), ...awards] };
}
