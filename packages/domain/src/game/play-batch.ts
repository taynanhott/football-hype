import { cupReturnDate } from '../competitions/season-calendar.js';
import { nextRealMatchTime, scheduledBatches } from './season-clock.js';
import { COMPETITIONS, GAMEPLAY, type Fixture, type WorldState } from '@football/shared';
import {
  applyPreLibertadores,
  scheduleIntercontinental,
  penaltyShootout,
} from '../competitions/season-finale.js';
import { standings } from '../competitions/standings.js';
import { simulateMatch } from '../simulation/match.js';
import { matchDemand } from '../finance/match-demand.js';
import { hashSeed, mulberry32 } from '../simulation/random.js';
import { appearanceGrowth, revalueGrowth } from '../players/development.js';
import { resolveLineup, resolveBench, injuryProbability } from './tactics.js';
import { qualifyCupGroups } from '../competitions/cup-groups.js';
import { advanceBracket } from '../competitions/knockout.js';
import { settleMonthly, generateIncomingOffers, tacticalBonus } from './management.js';
import { failure, success, type Result } from '../core/result.js';
import { domainError } from '../core/domain-error.js';
import { nextSeasonState } from '../multiplayer/machines.js';

const DAY_MS = 86_400_000;
export function pendingFixtures(state: WorldState): Fixture[] {
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const cupFixtures: Fixture[] = [];
  for (const node of state.cups) {
    if (!node.homeId || !node.awayId || node.winnerId) continue;
    const legs =
      node.legs ?? COMPETITIONS.find((rule) => rule.id === node.competitionId)?.legs ?? 1;
    if (legs === 2 && !completed.has(`${node.id}:first`)) {
      cupFixtures.push({
        id: `${node.id}:first`,
        competitionId: node.competitionId,
        homeId: node.homeId,
        awayId: node.awayId,
        scheduledAt: node.scheduledAt,
        round: node.round,
        ...(node.neutral ? { neutral: true } : {}),
        ...(node.stadiumId ? { stadiumId: node.stadiumId } : {}),
      });
    } else {
      cupFixtures.push({
        id: node.id,
        competitionId: node.competitionId,
        homeId: legs === 2 ? node.awayId : node.homeId,
        awayId: legs === 2 ? node.homeId : node.awayId,
        scheduledAt:
          legs === 2 ? cupReturnDate(node.competitionId, node.scheduledAt) : node.scheduledAt,
        round: node.round,
        ...(node.neutral ? { neutral: true } : {}),
        ...(node.stadiumId ? { stadiumId: node.stadiumId } : {}),
      });
    }
  }
  return [...state.fixtures.filter((fixture) => !completed.has(fixture.id)), ...cupFixtures].sort(
    (a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id),
  );
}

export function playNextBatch(state: WorldState, processedAt: number): Result<WorldState> {
  const pending = pendingFixtures(state);
  const scheduledAt = pending[0]?.scheduledAt;
  if (scheduledAt === undefined)
    return failure(domainError('VALIDATION_ERROR', 'Não existem partidas pendentes'));
  state = settleMonthly(state, scheduledAt);
  const batch = state.seasonClock
    ? scheduledBatches(pending)[0]!
    : pending.filter((fixture) => fixture.scheduledAt === scheduledAt);
  const centers = { ...state.centers.byId };
  const players = { ...state.players.byId };
  const clubs = { ...state.clubs.byId };
  const injuries = { ...state.injuries };
  const development = { ...state.development };
  const debts = { ...state.debts };
  const chemistry = Object.fromEntries(
    Object.entries(state.chemistry).map(([id, matches]) => [id, { ...matches }]),
  );
  const workload = { ...state.workload };
  const playedClubs = new Set<string>();
  const results = [...state.results];
  let cups = state.cups;
  const revenue = new Map<string, number>();
  const appeared = new Set<string>();
  const daysSince = Math.max(
    state.seasonClock ? 0 : 1,
    Math.min(7, (scheduledAt - state.lastProcessedAt) / DAY_MS),
  );
  for (const player of Object.values(players)) {
    const club = player.clubId ? clubs[player.clubId] : undefined;
    const center = club ? state.centers.byId[club.trainingCenterId] : undefined;
    players[player.id] = {
      ...player,
      fitness: Math.min(
        100,
        player.fitness +
          Math.floor(
            daysSince *
              (center?.operations?.fitness.includes(player.id) ? 1.5 : 1) *
              (GAMEPLAY.fitnessRecovery +
                (center?.levels.fitness ?? 1) * GAMEPLAY.recoveryPerLevel),
          ),
      ),
    };
  }
  for (const center of Object.values(centers)) {
    const ops = center.operations ?? {
      load: 'moderate' as const,
      fitness: [],
      medical: [],
      individual: [],
      syringe: false,
    };
    const load = ops.load === 'light' ? 0.5 : ops.load === 'intense' ? 1.5 : 1;
    const random = mulberry32(hashSeed(state.seed, `${center.id}:${scheduledAt}`));
    for (const id of clubs[center.clubId]?.playerIds ?? []) {
      const player = players[id];
      if (!player) continue;
      const individual = ops.individual.find((t) => t.playerId === id);
      if (!(state.injuries[id] ?? 0)) {
        const growth =
          (development[id] ?? 0) +
          daysSince * 0.006 * center.levels.coaching * load * (individual ? 1.5 : 1);
        players[id] = {
          ...player,
          overall: Math.max(
            player.overall,
            Math.min(player.potential, player.overall + Math.floor(growth)),
          ),
          fitness: Math.max(0, player.fitness - Math.floor(daysSince * load)),
        };
        development[id] = growth % 1;
        if (random() < (0.001 * daysSince * load * load) / center.levels.medical)
          injuries[id] = Math.max(1, Math.ceil(3 / center.levels.medical));
      }
      if (individual && scheduledAt >= individual.endsAt) {
        const current = players[id]!;
        players[id] = {
          ...current,
          overall: Math.min(99, current.overall + 1),
          potential: Math.max(current.potential, Math.min(99, current.overall + 1)),
        };
      }
      players[id] = revalueGrowth(player, players[id]!);
    }
    centers[center.id] = {
      ...center,
      operations: {
        ...ops,
        individual: ops.individual.filter((t) => t.endsAt > scheduledAt),
        fitness: ops.fitness.filter(
          (id) => (players[id]?.fitness ?? 100) < 100 && players[id]?.clubId === center.clubId,
        ),
        medical: ops.medical.filter(
          (id) => (state.injuries[id] ?? 0) > 0 && players[id]?.clubId === center.clubId,
        ),
      },
    };
  }
  state = { ...state, centers: { ...state.centers, byId: centers } };
  for (const fixture of batch) {
    const home = clubs[fixture.homeId];
    const away = clubs[fixture.awayId];
    const stadium = state.stadiums.byId[fixture.stadiumId ?? home?.stadiumId ?? ''];
    if (!home || !away || !stadium)
      return failure(domainError('ENTITY_NOT_FOUND', 'Dados incompletos da partida'));
    playedClubs.add(home.id);
    playedClubs.add(away.id);
    const clearedInjuries = { ...injuries };
    for (const center of Object.values(centers))
      if (center.operations?.clearance?.fixtureId === fixture.id)
        clearedInjuries[center.operations.clearance.playerId] = 0;
    const selectionState = { ...state, injuries: clearedInjuries };
    const homeSelection = resolveLineup(selectionState, home, scheduledAt, players);
    const awaySelection = resolveLineup(selectionState, away, scheduledAt, players);
    const effective = (entries: typeof homeSelection) =>
      entries.flatMap((entry) =>
        entry.player
          ? [{ ...entry.player, position: entry.position, overall: entry.effectiveOverall }]
          : [],
      );
    const homeLineup = homeSelection.flatMap((entry) => (entry.player ? [entry.player] : []));
    const awayLineup = awaySelection.flatMap((entry) => (entry.player ? [entry.player] : []));
    const homePlan = state.tactics[home.id] ?? {
      formation: '4-3-3' as const,
      starters: homeLineup.map((p) => p.id),
    };
    const awayPlan = state.tactics[away.id] ?? {
      formation: '4-3-3' as const,
      starters: awayLineup.map((p) => p.id),
    };
    const homeBonus = tacticalBonus(
      homePlan.style ?? 'balanced',
      homePlan.formation,
      awayPlan.style ?? 'balanced',
      awayPlan.formation,
      effective(homeSelection),
    );
    const awayBonus = tacticalBonus(
      awayPlan.style ?? 'balanced',
      awayPlan.formation,
      homePlan.style ?? 'balanced',
      homePlan.formation,
      effective(awaySelection),
    );
    const adjusted = (selection: typeof homeSelection, bonus: number) =>
      effective(selection).map((p) => ({
        ...p,
        overall: Math.max(1, Math.min(99, Math.round(p.overall + bonus))),
      }));
    const result = simulateMatch(
      fixture,
      adjusted(homeSelection, homeBonus),
      adjusted(awaySelection, awayBonus),
      stadium,
      hashSeed(state.seed, String(state.season)),
      undefined,
      matchDemand(state, fixture),
      { home: homePlan.style ?? 'balanced', away: awayPlan.style ?? 'balanced' },
    );
    result.tacticalPlans = {
      home: {
        ...homePlan,
        starters: homeLineup.map((p) => p.id),
        bench: resolveBench(
          state,
          home,
          scheduledAt,
          homeLineup.map((p) => p.id),
          homePlan.bench,
        ),
      },
      away: {
        ...awayPlan,
        starters: awayLineup.map((p) => p.id),
        bench: resolveBench(
          state,
          away,
          scheduledAt,
          awayLineup.map((p) => p.id),
          awayPlan.bench,
        ),
      },
    };
    result.startedAt = processedAt;
    results.push(result);
    revenue.set(home.id, (revenue.get(home.id) ?? 0) + result.revenue);
    const random = mulberry32(result.seed);
    for (const player of [...homeLineup, ...awayLineup]) {
      appeared.add(player.id);
      const load = workload[player.id];
      const consecutive = (load?.consecutiveMatches ?? 0) + 1;
      const restHours = load ? Math.max(0, (scheduledAt - load.lastPlayedAt) / 3600000) : 168;
      workload[player.id] = { lastPlayedAt: scheduledAt, consecutiveMatches: consecutive };
      if (player.clubId) {
        const matches = chemistry[player.clubId] ?? {};
        chemistry[player.clubId] = { ...matches, [player.id]: (matches[player.id] ?? 0) + 1 };
      }
      const center = player.clubId
        ? state.centers.byId[clubs[player.clubId]?.trainingCenterId ?? '']
        : undefined;
      const grown = appearanceGrowth(
        player,
        center?.levels.coaching ?? 1,
        development[player.id] ?? 0,
      );
      development[player.id] = grown.progress;
      players[player.id] = {
        ...grown.player,
        appearances: player.appearances + 1,
        fitness: Math.max(
          0,
          player.fitness -
            Math.ceil(
              (GAMEPLAY.fitnessCost + Math.min(10, Math.max(0, consecutive - 2) * 2)) /
                (1 +
                  ((center?.levels.fitness ?? 1) - 1) * GAMEPLAY.fitnessFatigueReductionPerLevel),
            ),
        ),
        morale: Math.max(
          0,
          Math.min(
            100,
            player.morale +
              (player.clubId === home.id
                ? result.homeGoals - result.awayGoals
                : result.awayGoals - result.homeGoals),
          ),
        ),
      };
      if (
        random() <
        injuryProbability(player.fitness, consecutive, restHours, center?.levels.medical ?? 1)
      )
        injuries[player.id] = Math.max(
          1,
          Math.ceil((random() * GAMEPLAY.injuryMaxMatches) / (center?.levels.medical ?? 1)),
        );
    }
    const node = cups.find((candidate) => candidate.id === fixture.id);
    if (node) {
      const first = results.find((item) => item.fixtureId === `${node.id}:first`);
      const homeGoals = result.homeGoals + (first?.awayGoals ?? 0);
      const awayGoals = result.awayGoals + (first?.homeGoals ?? 0);
      const penalties = homeGoals === awayGoals ? penaltyShootout(random) : undefined;
      if (penalties) result.penalties = penalties;
      const winner =
        homeGoals === awayGoals
          ? penalties!.home > penalties!.away
            ? home.id
            : away.id
          : homeGoals > awayGoals
            ? home.id
            : away.id;
      const advanced = advanceBracket(cups, node.id, winner);
      if (advanced.ok) cups = [...advanced.value];
    }
  }
  for (const player of Object.values(players)) {
    if (!player.clubId || !playedClubs.has(player.clubId) || appeared.has(player.id)) continue;
    const load = workload[player.id];
    if (load) workload[player.id] = { ...load, consecutiveMatches: 0 };
    if ((state.injuries[player.id] ?? 0) > 0) {
      const center = centers[clubs[player.clubId]?.trainingCenterId ?? ''];
      const ops = center?.operations;
      const progress =
        (ops?.medicalProgress?.[player.id] ?? 0) + (ops?.medical.includes(player.id) ? 1.5 : 1);
      injuries[player.id] = Math.max(0, (state.injuries[player.id] ?? 0) - Math.floor(progress));
      if (center && ops)
        centers[center.id] = {
          ...center,
          operations: {
            ...ops,
            medicalProgress: { ...ops.medicalProgress, [player.id]: progress % 1 },
            medical: ops.medical.filter((id) => (injuries[id] ?? 0) > 0),
          },
        };
    }
  }
  for (const center of Object.values(centers)) {
    if (
      center.operations?.clearance &&
      batch.some((f) => f.id === center.operations?.clearance?.fixtureId)
    ) {
      const operations = { ...center.operations };
      delete operations.clearance;
      centers[center.id] = { ...center, operations };
    }
  }
  const leagueBatch = batch.some((fixture) => fixture.competitionId.startsWith('serie-'));
  for (const club of Object.values(clubs)) {
    const center = state.centers.byId[club.trainingCenterId];
    if (leagueBatch) {
      const sponsor =
        ((center?.levels.marketing ?? 1) >= 3 ? GAMEPLAY.marketingSponsorCents : 0) +
        GAMEPLAY.startingSponsorCents +
        (center?.levels.marketing ?? 1) * GAMEPLAY.marketingSponsorCents;
      clubs[club.id] = {
        ...club,
        balance: {
          ...club.balance,
          cents: club.balance.cents + (revenue.get(club.id) ?? 0) + sponsor,
        },
      };
    } else {
      clubs[club.id] = {
        ...club,
        balance: { ...club.balance, cents: club.balance.cents + (revenue.get(club.id) ?? 0) },
      };
    }
  }
  const trophies = [...state.trophies];
  for (const rule of COMPETITIONS.filter((rule) => rule.id !== 'pre-libertadores')) {
    if (trophies.some((t) => t.competitionId === rule.id && t.season === state.season)) continue;
    const fixtures = state.fixtures.filter((f) => f.competitionId === rule.id);
    let champion: string | undefined;
    if (
      rule.format === 'league' &&
      fixtures.length &&
      fixtures.every((f) => results.some((r) => r.fixtureId === f.id))
    ) {
      champion = standings(
        state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === rule.division),
        fixtures,
        results,
        rule.tieBreakers,
      )[0]?.id;
    } else if (rule.format !== 'league') {
      champion =
        cups.find(
          (n) =>
            n.competitionId === rule.id &&
            !cups.some((parent) => parent.leftId === n.id || parent.rightId === n.id),
        )?.winnerId ?? undefined;
    }
    if (champion)
      trophies.push({
        clubId: champion,
        competitionId: rule.id,
        season: state.season,
        wonAt: processedAt,
      });
  }
  let next = applyPreLibertadores(
    qualifyCupGroups({
      ...state,
      centers: { ...state.centers, byId: centers },
      players: { ...state.players, byId: players },
      clubs: { ...state.clubs, byId: clubs },
      injuries,
      chemistry,
      workload,
      development,
      debts,
      results,
      negotiations: state.negotiations.map((offer) =>
        offer.status === 'salary' && (offer.expiresAt ?? Infinity) <= scheduledAt
          ? { ...offer, status: 'rejected' as const, reply: 'Prazo da proposta encerrado.' }
          : offer,
      ),
      trophies,
      ratingHistory: [
        ...state.ratingHistory,
        ...results.slice(state.results.length).flatMap((r) =>
          Object.entries(r.ratings ?? {}).map(([playerId, rating]) => ({
            fixtureId: r.fixtureId,
            season: state.season,
            playerId,
            rating,
          })),
        ),
      ],
      cups,
      round: state.round + 1,
      participants: state.participants.map((member) => ({ ...member, ready: false })),
      lastProcessedAt: scheduledAt,
    }),
  );
  if (!pendingFixtures(next).length) next = scheduleIntercontinental(next);
  const nextTime = pendingFixtures(next)[0]?.scheduledAt;
  next = generateIncomingOffers(next);
  return success({
    ...next,
    status: nextTime === undefined ? nextSeasonState('active', 'FINISH') : 'active',
    nextScheduledAt:
      nextTime === undefined
        ? processedAt
        : state.seasonClock
          ? nextRealMatchTime(processedAt)
          : nextTime,
  });
}
