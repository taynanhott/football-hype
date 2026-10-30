import { ageFatigueFactor, moraleSensitivity } from './player-contracts.js';
import { upgradeUnstartedCompetitions } from '../competitions/upgrade-formats.js';
import { resolveRegionalQualifiers } from '../competitions/regional-qualifiers.js';
import { advanceGameDays } from './daily-calendar.js';
import { scheduledFixtures } from '../competitions/fixtures.js';
import { normalizeRoundCalendar } from '../competitions/round-calendar.js';
import { nextRealMatchTime, scheduledBatches } from './season-clock.js';
import {
  COMPETITIONS,
  GAMEPLAY,
  type Fixture,
  type WorldState,
  type PlayStyle,
  type Formation,
} from '@football/shared';
import {
  applyPreLibertadores,
  scheduleIntercontinental,
  penaltyShootout,
} from '../competitions/season-finale.js';
import { standings } from '../competitions/standings.js';
import { simulateMatch } from '../simulation/match.js';
import { matchDemand } from '../finance/match-demand.js';
import { hashSeed, mulberry32 } from '../simulation/random.js';
import {
  officialMatchDevelopment,
  emptyTrainingProgression,
  currentTrainingHistory,
} from './training-progression.js';
import { resolveLineup, resolveBench, injuryProbability } from './tactics.js';
import { qualifyCupGroups } from '../competitions/cup-groups.js';
import { advanceBracket } from '../competitions/knockout.js';
import { settleMonthly, generateIncomingOffers, tacticalBonus } from './management.js';
import { failure, success, type Result } from '../core/result.js';
import { domainError } from '../core/domain-error.js';
import { nextSeasonState } from '../multiplayer/machines.js';

export function pendingFixtures(state: WorldState): Fixture[] {
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const all = scheduledFixtures(state);
  return all.filter((fixture) => {
    if (completed.has(fixture.id)) return false;
    const node = state.cups.find(
      (node) => node.id === fixture.id || `${node.id}:first` === fixture.id,
    );
    return (
      !node ||
      (!node.winnerId &&
        (fixture.id.endsWith(':first') ||
          !all.some((first) => first.id === `${node.id}:first`) ||
          completed.has(`${node.id}:first`)))
    );
  });
}
export function playNextBatch(state: WorldState, processedAt: number): Result<WorldState> {
  state = normalizeRoundCalendar(upgradeUnstartedCompetitions(state));
  let pending = pendingFixtures(state);
  const scheduledAt = pending[0]?.scheduledAt;
  if (scheduledAt === undefined)
    return failure(domainError('VALIDATION_ERROR', 'Não existem partidas pendentes'));
  state = settleMonthly(advanceGameDays(state, scheduledAt), scheduledAt);
  pending = pendingFixtures(state);
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
  // Scout only completed matches; never inspect an opponent's current private plan.
  const recentPlans = new Map<string, Array<{ formation: Formation; style: PlayStyle }>>();
  for (const result of state.results) {
    for (const side of ['home', 'away'] as const) {
      const id = side === 'home' ? result.homeId : result.awayId;
      const plan = result.tacticalPlans?.[side];
      if (!id || !plan) continue;
      const history = recentPlans.get(id) ?? [];
      history.push({ formation: plan.formation, style: plan.style ?? 'balanced' });
      if (history.length > 5) history.shift();
      recentPlans.set(id, history);
    }
  }
  const humanClubs = new Set(state.participants.map((participant) => participant.clubId));
  const botStyle = (id: string, opponentId: string): PlayStyle => {
    const saved = state.tactics[id];
    const current = saved?.style ?? 'balanced';
    const history = recentPlans.get(opponentId);
    if (humanClubs.has(id) || !history?.length) return current;
    const available = resolveLineup(state, clubs[id]!, scheduledAt, players).flatMap((entry) =>
      entry.player
        ? [{ ...entry.player, position: entry.position, overall: entry.effectiveOverall }]
        : [],
    );
    const styles: PlayStyle[] = [
      current,
      'balanced',
      'wings',
      'gegenpress',
      'low-block',
      'possession',
      'counter',
    ];
    let best = current,
      bestScore = -Infinity;
    for (const style of new Set(styles)) {
      const score = history.reduce(
        (sum, plan, index) =>
          sum +
          (index + 1) *
            tacticalBonus(
              style,
              saved?.formation ?? '4-3-3',
              plan.style,
              plan.formation,
              available,
            ),
        0,
      );
      if (score > bestScore) {
        best = style;
        bestScore = score;
      }
    }
    return best;
  };
  const playedClubs = new Set<string>();
  const results = [...state.results];
  let cups = state.cups;
  const revenue = new Map<string, number>();
  const appeared = new Set<string>();
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
    const homeStyle = botStyle(home.id, away.id);
    const awayStyle = botStyle(away.id, home.id);
    const selectionState = {
      ...state,
      injuries: clearedInjuries,
      tactics: {
        ...state.tactics,
        [home.id]: {
          ...(state.tactics[home.id] ?? { formation: '4-3-3' as const, starters: [] }),
          style: homeStyle,
        },
        [away.id]: {
          ...(state.tactics[away.id] ?? { formation: '4-3-3' as const, starters: [] }),
          style: awayStyle,
        },
      },
    };
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
    const homePlan = selectionState.tactics[home.id] ?? {
      formation: '4-3-3' as const,
      starters: homeLineup.map((p) => p.id),
    };
    const awayPlan = selectionState.tactics[away.id] ?? {
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
    result.coachUserIds = Object.fromEntries(
      (['home', 'away'] as const).flatMap((side) => {
        const member = state.participants.find(
          (item) => item.clubId === (side === 'home' ? home.id : away.id),
        );
        return member ? [[side, member.userId]] : [];
      }),
    );
    result.tacticalPlans = {
      home: {
        ...homePlan,
        style: homePlan.style ?? 'balanced',
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
        style: awayPlan.style ?? 'balanced',
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
        ? centers[clubs[player.clubId]?.trainingCenterId ?? '']
        : undefined;
      const grown = officialMatchDevelopment(
        player,
        development[player.id] ?? 0,
        center?.operations?.progression?.[player.id] ?? emptyTrainingProgression(),
        center?.levels.coaching ?? 1,
        Boolean(center?.operations?.individual.some((plan) => plan.playerId === player.id)),
      );
      const trainingHistory = currentTrainingHistory(
        center?.operations?.trainingHistory?.[player.id],
        state.season,
      );
      const previousProgress =
        center?.operations?.progression?.[player.id] ?? emptyTrainingProgression();
      if (player.age <= 33 && player.overall < player.potential)
        trainingHistory.growth +=
          grown.player.overall - player.overall + grown.development - (development[player.id] ?? 0);
      trainingHistory.bonus +=
        grown.progression.buff -
        previousProgress.buff +
        grown.progression.buffProgress -
        previousProgress.buffProgress;
      trainingHistory.decline = Math.max(
        0,
        trainingHistory.decline +
          grown.progression.declineProgress -
          previousProgress.declineProgress,
      );
      development[player.id] = grown.development;
      const cycleBonuses = { ...center?.operations?.cycleBonuses };
      if (cycleBonuses[player.id]) {
        const games = cycleBonuses[player.id]!.games - 1;
        if (games > 0) cycleBonuses[player.id] = { games };
        else delete cycleBonuses[player.id];
      }
      if (center)
        centers[center.id] = {
          ...center,
          operations: {
            load: 'moderate',
            fitness: [],
            medical: [],
            individual: [],
            syringe: false,
            ...center.operations,
            cycleBonuses,
            progression: { ...center.operations?.progression, [player.id]: grown.progression },
            lastOfficialTrainingAt: {
              ...center.operations?.lastOfficialTrainingAt,
              [player.id]: scheduledAt,
            },
            trainingHistory: {
              ...center.operations?.trainingHistory,
              [player.id]: trainingHistory,
            },
          },
        };
      players[player.id] = {
        ...grown.player,
        appearances: player.appearances + 1,
        fitness: Math.max(
          0,
          player.fitness -
            Math.ceil(
              ((GAMEPLAY.fitnessCost + Math.min(10, Math.max(0, consecutive - 2) * 2)) *
                ageFatigueFactor(player.age)) /
                (1 +
                  ((center?.levels.fitness ?? 1) - 1) * GAMEPLAY.fitnessFatigueReductionPerLevel),
            ),
        ),
        morale: Math.round(
          Math.max(
            0,
            Math.min(
              100,
              player.morale +
                ((player.clubId === home.id
                  ? result.homeGoals - result.awayGoals
                  : result.awayGoals - result.homeGoals) +
                  ((result.ratings?.[player.id] ?? 6.5) - 6.5) +
                  Math.min(2, consecutive * 0.3)) *
                  moraleSensitivity(player),
            ),
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
        ...(state.participants.find((member) => member.clubId === champion)
          ? { coachUserId: state.participants.find((member) => member.clubId === champion)!.userId }
          : {}),
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
  next = resolveRegionalQualifiers(next);
  if (!pendingFixtures(next).length) next = scheduleIntercontinental(next);
  next = normalizeRoundCalendar(next);
  const nextTime = pendingFixtures(next)[0]?.scheduledAt;
  next = generateIncomingOffers(next);
  return success({
    ...next,
    ...(state.seasonClock ? { calendarAnchor: { realAt: processedAt, gameAt: scheduledAt } } : {}),
    status: nextTime === undefined ? nextSeasonState('active', 'FINISH') : 'active',
    nextScheduledAt:
      nextTime === undefined
        ? processedAt
        : state.seasonClock
          ? nextRealMatchTime(processedAt)
          : nextTime,
  });
}
