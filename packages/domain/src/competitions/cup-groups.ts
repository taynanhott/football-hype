import { competitionDates } from './season-calendar.js';
import { COMPETITIONS, knockoutLegs, type Fixture, type WorldState } from '@football/shared';
import { roundRobin } from './round-robin.js';
import { standings } from './standings.js';
import { buildBracket } from './knockout.js';
import { calendarDates } from './calendar.js';
import { hashSeed } from '../simulation/random.js';

export function groupFixtures(
  ids: readonly string[],
  competitionId: string,
  dates: readonly number[],
  legs: 1 | 2 = 2,
): Fixture[] {
  const rule = COMPETITIONS.find((r) => r.id === competitionId);
  const size = rule?.groupSize ?? 4;
  if (ids.length < size || ids.length % size !== 0) return [];
  const count = ids.length / size;
  const groups: string[][] = Array.from({ length: count }, () => []);
  ids.forEach((id, index) => {
    const group =
      competitionId === 'copa-verde' && count === 4 && size === 6
        ? Math.floor(index / 12) * 2 + (index % 2)
        : index % count;
    groups[group]!.push(id);
  });
  const make = (
    homeId: string,
    awayId: string,
    groupIndex: number,
    awayIndex: number,
    round: number,
  ): Fixture => ({
    id: `${competitionId}:group:${String.fromCharCode(65 + groupIndex)}:${round}:${homeId}`,
    competitionId,
    homeId,
    awayId,
    group: String.fromCharCode(65 + groupIndex),
    awayGroup: String.fromCharCode(65 + awayIndex),
    round,
    scheduledAt: dates[round]!,
  });
  if (rule?.groupMode === 'paired') {
    return groups.flatMap((a, index) =>
      index % 2
        ? []
        : Array.from({ length: size }, (_, round) =>
            a.map((id, slot) => {
              const opponent = groups[index + 1]![(slot + round) % size]!;
              return round % 2 === 0
                ? make(id, opponent, index, index + 1, round)
                : make(opponent, id, index + 1, index, round);
            }),
          ).flat(),
    );
  }
  if (rule?.groupMode === 'external') {
    const groupById = new Map(
      groups.flatMap((group, index) => group.map((id) => [id, index] as const)),
    );
    const schedule = roundRobin(ids, 1);
    return schedule.ok
      ? schedule.value
          .filter((f) => groupById.get(f.homeId) !== groupById.get(f.awayId))
          .map((f) =>
            make(f.homeId, f.awayId, groupById.get(f.homeId)!, groupById.get(f.awayId)!, f.round),
          )
      : [];
  }
  return groups.flatMap((teams, index) => {
    const schedule = roundRobin(teams, legs);
    return schedule.ok
      ? schedule.value.map((f) => make(f.homeId, f.awayId, index, index, f.round))
      : [];
  });
}

export function cupGroupTables(
  state: Pick<WorldState, 'fixtures' | 'results'>,
  competitionId: string,
) {
  const fixtures = state.fixtures.filter((f) => f.competitionId === competitionId && f.group);
  const membership = new Map<string, string>();
  for (const fixture of fixtures) {
    membership.set(fixture.homeId, fixture.group!);
    membership.set(fixture.awayId, fixture.awayGroup ?? fixture.group!);
  }
  const rule = COMPETITIONS.find((r) => r.id === competitionId);
  return [...new Set(membership.values())].sort().map((group) => {
    const ids = [...membership].filter(([, label]) => label === group).map(([id]) => id);
    const matches = fixtures.filter((f) => ids.includes(f.homeId) || ids.includes(f.awayId));
    const all = standings(ids, matches, state.results, rule?.tieBreakers);
    const conmebol = ['libertadores', 'sul-americana'].includes(competitionId);
    const matchIds = new Set(matches.map((f) => f.id));
    const relevant = state.results.filter((r) => matchIds.has(r.fixtureId));
    const cards = (id: string, type: string) =>
      relevant.reduce(
        (total, result) =>
          total +
          (result.actions ?? []).filter(
            (a) => a.type === type && (a.side === 'home' ? result.homeId : result.awayId) === id,
          ).length,
        0,
      );
    const table = [...all].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      const tied = all.filter((row) => row.points === a.points).map((row) => row.id);
      const headFixtures = matches.filter(
        (f) => tied.includes(f.homeId) && tied.includes(f.awayId),
      );
      if (conmebol) {
        const head = standings(tied, headFixtures, relevant, [
          'points',
          'goalDifference',
          'goalsFor',
          'id',
        ]);
        const ha = head.find((row) => row.id === a.id)!,
          hb = head.find((row) => row.id === b.id)!;
        const delta =
          hb.points - ha.points ||
          hb.goalDifference - ha.goalDifference ||
          hb.goalsFor - ha.goalsFor;
        if (delta) return delta;
      }
      const base =
        (!conmebol ? b.wins - a.wins : 0) ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor;
      if (base) return base;
      return (
        cards(a.id, 'red') - cards(b.id, 'red') ||
        cards(a.id, 'yellow') - cards(b.id, 'yellow') ||
        hashSeed(2026, a.id) - hashSeed(2026, b.id)
      );
    });
    return { group, fixtures: matches, table };
  });
}

export function qualifyCupGroups(state: WorldState): WorldState {
  const cups = [...state.cups];
  const completed = new Set(state.results.map((r) => r.fixtureId));
  for (const rule of COMPETITIONS.filter((r) => r.groupSize)) {
    if (cups.some((n) => n.competitionId === rule.id)) continue;
    const groups = cupGroupTables(state, rule.id);
    if (groups.length < 2 || groups.some((g) => g.fixtures.some((f) => !completed.has(f.id))))
      continue;
    const qualified: string[] = [];
    if (
      rule.advancement === 'sudamericana' &&
      cupGroupTables(state, 'libertadores').length === groups.length
    ) {
      const lib = cupGroupTables(state, 'libertadores');
      if (
        lib.length !== groups.length ||
        lib.some((g) => g.fixtures.some((f) => !completed.has(f.id)))
      )
        continue;
      const playoffIds = groups.flatMap((g, index) => [lib[index]!.table[2]!.id, g.table[1]!.id]);

      const playoffDate =
        competitionDates('sul-americana', state.season, 1, true)[0]! - 21 * 86400000;
      const finalRound = Math.log2(groups.length);
      // Winners receive a bye to the round of 16; runners-up play Libertadores third places.
      const dates = [playoffDate, ...competitionDates(rule.id, state.season, finalRound + 1, true)];
      const bracket = buildBracket(
        groups.flatMap((g, index) => [g.table[0]!.id, playoffIds[index * 2]!]),
        rule.id,
        dates.slice(1),
      );
      if (!bracket.ok) continue;
      const nodes = bracket.value.map((node) => ({
        ...node,
        legs: knockoutLegs(rule.id, node.round + 1, finalRound + 1),
      }));
      groups.forEach((group, index) => {
        const playoffId = `${rule.id}:playoff:${index}`;
        const parent = nodes.find((n) => n.round === 0 && n.homeId === group.table[0]!.id)!;
        Object.assign(parent, { awayId: null, rightId: playoffId });
        cups.push({
          id: playoffId,
          competitionId: rule.id,
          round: 0,
          homeId: playoffIds[index * 2]!,
          awayId: group.table[1]!.id,
          leftId: null,
          rightId: null,
          winnerId: null,
          scheduledAt: playoffDate,
          legs: 2,
          label: 'Playoff das oitavas',
        });
      });
      cups.push(...nodes.map((node) => ({ ...node, round: node.round + 1 })));
      continue;
    }
    if (rule.advancement === 'mineiro') {
      const leaders = groups.map((g) => g.table[0]!);
      const runners = groups
        .map((g) => g.table[1]!)
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.wins - a.wins ||
            b.goalDifference - a.goalDifference ||
            b.goalsFor - a.goalsFor,
        );
      const seeded = [...leaders, runners[0]!].sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          b.goalDifference - a.goalDifference ||
          b.goalsFor - a.goalsFor,
      );
      qualified.push(seeded[3]!.id, seeded[0]!.id, seeded[2]!.id, seeded[1]!.id);
    } else if (rule.advancement === 'sul-sudeste') {
      for (const group of groups) qualified.push(group.table[1]!.id, group.table[0]!.id);
    } else if (rule.advancement === 'nordeste') {
      for (const [a, b] of [
        [0, 2],
        [3, 1],
        [1, 3],
        [2, 0],
      ] as const)
        qualified.push(groups[a]!.table[0]!.id, groups[b]!.table[1]!.id);
    } else if (rule.advancement === 'carioca') {
      for (const group of groups)
        qualified.push(
          group.table[0]!.id,
          group.table[3]!.id,
          group.table[1]!.id,
          group.table[2]!.id,
        );
    } else {
      for (let i = 0; i < groups.length; i += 2) {
        const a = groups[i]!,
          b = groups[i + 1];
        if (b) qualified.push(a.table[0]!.id, b.table[1]!.id, b.table[0]!.id, a.table[1]!.id);
      }
    }
    const last = Math.max(...groups.flatMap((g) => g.fixtures.map((f) => f.scheduledAt)));
    const rounds = Math.log2(qualified.length);
    const reference = competitionDates(rule.id, state.season, rounds, true);
    const dates =
      reference[0]! > last
        ? reference
        : calendarDates(last, rounds * 2, true).filter((_, i) => i % 2 === 0);
    const bracket = buildBracket(qualified, rule.id, dates);
    if (bracket.ok)
      cups.push(
        ...bracket.value.map((node) => ({
          ...node,
          legs: knockoutLegs(rule.id, node.round, rounds - 1),
        })),
      );
  }
  return { ...state, cups };
}

// Older uniform group tournaments are regularized through an explicit season reset.
export function addUnstartedCupGroups(state: WorldState): WorldState {
  return state;
}
