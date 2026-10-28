import type { CompetitionRule, Fixture, MatchResult } from '@football/shared';

export type Standing = Readonly<{
  id: string;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}>;

export function standings(
  ids: readonly string[],
  fixtures: readonly Fixture[],
  results: readonly MatchResult[],
  tieBreakers: CompetitionRule['tieBreakers'] = [
    'points',
    'wins',
    'goalDifference',
    'goalsFor',
    'redCards',
    'yellowCards',
    'id',
  ],
): readonly Standing[] {
  const rows: Record<string, Standing> = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        id,
        played: 0,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      },
    ]),
  );
  const matches = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  for (const result of results) {
    const fixture = matches.get(result.fixtureId);
    if (!fixture) continue;
    for (const [id, scored, conceded] of [
      [fixture.homeId, result.homeGoals, result.awayGoals],
      [fixture.awayId, result.awayGoals, result.homeGoals],
    ] as const) {
      const row = rows[id];
      if (!row) continue;
      const won = scored > conceded;
      const draw = scored === conceded;
      rows[id] = {
        ...row,
        played: row.played + 1,
        points: row.points + (won ? 3 : draw ? 1 : 0),
        wins: row.wins + Number(won),
        draws: row.draws + Number(draw),
        losses: row.losses + Number(!won && !draw),
        goalsFor: row.goalsFor + scored,
        goalsAgainst: row.goalsAgainst + conceded,
        goalDifference: row.goalDifference + scored - conceded,
      };
    }
  }
  const cards = (id: string, type: string) =>
    results
      .filter((result) => matches.has(result.fixtureId))
      .reduce(
        (total, result) =>
          total +
          (result.actions ?? []).filter(
            (action) =>
              action.type === type &&
              (action.side === 'home'
                ? matches.get(result.fixtureId)!.homeId
                : matches.get(result.fixtureId)!.awayId) === id,
          ).length,
        0,
      );
  return Object.freeze(
    Object.values(rows)
      .sort((a, b) => {
        for (const criterion of tieBreakers) {
          const comparison =
            criterion === 'id'
              ? a.id.localeCompare(b.id)
              : criterion === 'redCards'
                ? cards(a.id, 'red') - cards(b.id, 'red')
                : criterion === 'yellowCards'
                  ? cards(a.id, 'yellow') - cards(b.id, 'yellow')
                  : b[criterion] - a[criterion];
          if (comparison) return comparison;
        }
        return 0;
      })
      .map((row) => Object.freeze(row)),
  );
}

export const ACCESS_GRAPH = Object.freeze({
  A: { relegation: 'B', promotion: null },
  B: { relegation: 'C', promotion: 'A' },
  C: { relegation: 'D', promotion: 'B' },
  D: { relegation: null, promotion: 'C' },
  REGIONAL: { relegation: null, promotion: 'C' },
} as const);
export function qualificationPlaces(table: readonly Standing[], rule: CompetitionRule) {
  return Object.freeze({
    promoted: table.slice(0, rule.promote).map((row) => row.id),
    relegated: rule.relegate ? table.slice(-rule.relegate).map((row) => row.id) : [],
    libertadores: table.slice(0, rule.continental).map((row) => row.id),
    sulAmericana: table
      .slice(rule.continental, rule.continental + rule.secondaryContinental)
      .map((row) => row.id),
  });
}
