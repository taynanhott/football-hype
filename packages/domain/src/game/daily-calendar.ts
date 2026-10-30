import {
  progressTraining,
  emptyTrainingProgression,
  currentTrainingHistory,
} from './training-progression.js';
import { ageFatigueFactor, initializeContractHistory } from './player-contracts.js';
import { normalizeRoundCalendar } from '../competitions/round-calendar.js';
import { realizeCompetitionDraws } from '../competitions/competition-draws.js';
import { GAMEPLAY, type Fixture, type WorldState } from '@football/shared';
import { scheduledFixtures } from '../competitions/fixtures.js';
import { revalueGrowth } from '../players/development.js';
import { hashSeed, mulberry32 } from '../simulation/random.js';
import { settleMonthly } from './management.js';

export const GAME_DAY_MS = 86_400_000;
const OFFSET = 10_800_000;
export const gameDayStart = (at: number) =>
  Math.floor((at - OFFSET) / GAME_DAY_MS) * GAME_DAY_MS + OFFSET;
export type DayRoutine = 'match' | 'training' | 'recovery' | 'rest' | 'eve';

export function clubDayRoutine(
  fixtures: readonly Fixture[],
  clubId: string,
  at: number,
): DayRoutine {
  const day = gameDayStart(at);
  const dates = new Set(
    fixtures
      .filter((f) => f.homeId === clubId || f.awayId === clubId)
      .map((f) => gameDayStart(f.scheduledAt)),
  );
  return routineAt(dates, day);
}
function routineAt(dates: Set<number>, day: number): DayRoutine {
  if (dates.has(day)) return 'match';
  if (dates.has(day - GAME_DAY_MS)) return 'recovery';
  if (dates.has(day + GAME_DAY_MS)) return 'eve';
  if (dates.has(day - 2 * GAME_DAY_MS)) return 'rest';
  return 'training';
}

/** Complete each elapsed game day once; manual and real-time advancement share this path. */
function advanceGameDaysInternal(state: WorldState, target: number): WorldState {
  const start = gameDayStart(state.lastProcessedAt);
  const end = gameDayStart(target);
  if (end <= start) return finishIndividualCycles(state, target);
  state = initializeContractHistory(state);
  const dates = new Map<string, Set<number>>();
  for (const fixture of scheduledFixtures(state)) {
    for (const id of [fixture.homeId, fixture.awayId]) {
      const days = dates.get(id) ?? new Set<number>();
      days.add(gameDayStart(fixture.scheduledAt));
      dates.set(id, days);
    }
  }
  const players = { ...state.players.byId };
  const centers = { ...state.centers.byId };
  const injuries = { ...state.injuries };
  const development = { ...state.development };
  const drawDays = new Set(
    (state.competitionDraws ?? []).map((draw) => gameDayStart(draw.scheduledAt)),
  );
  for (let day = start; day < end; day += GAME_DAY_MS) {
    for (const center of Object.values(centers)) {
      const scheduledRoutine = routineAt(dates.get(center.clubId) ?? new Set(), day);
      const routine =
        drawDays.has(day) && scheduledRoutine !== 'match' ? 'training' : scheduledRoutine;
      const ops = center.operations ?? {
        load: 'moderate' as const,
        fitness: [],
        medical: [],
        individual: [],
        syringe: false,
      };
      const recovery =
        routine === 'rest' ? 1.8 : routine === 'recovery' ? 2 : routine === 'eve' ? 1.3 : 1;
      const random = mulberry32(hashSeed(state.seed, `${center.id}:day:${day}`));
      const medicalProgress = { ...ops.medicalProgress };
      const effort = { ...ops.effort };
      const progression = { ...ops.progression };
      const cycleBonuses = { ...ops.cycleBonuses };
      const trainingHistory = { ...ops.trainingHistory };
      const completed = new Set<string>();
      for (const id of state.clubs.byId[center.clubId]?.playerIds ?? []) {
        const player = players[id];
        if (!player) continue;
        const officialDay = ops.lastOfficialTrainingAt?.[id];
        const setting =
          officialDay !== undefined && gameDayStart(officialDay) === day
            ? 'intense'
            : (ops.playerLoads?.[id] ?? 'moderate');
        const load = setting === 'light' ? 0.5 : setting === 'intense' ? 1.5 : 1;
        effort[id] = Math.max(
          0,
          Math.min(
            12,
            (effort[id] ?? 0) +
              (routine === 'training'
                ? setting === 'intense'
                  ? 1
                  : setting === 'moderate'
                    ? -0.5
                    : -1.5
                : -2),
          ),
        );
        const ageFatigue = ageFatigueFactor(player.age);
        const injured = (injuries[id] ?? 0) > 0;
        const history = currentTrainingHistory(trainingHistory[id], state.season);
        history.days++;
        const previousProgress = progression[id] ?? emptyTrainingProgression();
        const individual = ops.individual.find((plan) => plan.playerId === id);
        let next = {
          ...player,
          fitness: Math.min(
            100,
            player.fitness +
              Math.floor(
                (((GAMEPLAY.fitnessRecovery + center.levels.fitness * GAMEPLAY.recoveryPerLevel) *
                  recovery *
                  (routine === 'training' ? 0.2 : 1)) /
                  ageFatigue) *
                  (ops.fitness.includes(id) ? 1.5 : 1),
              ),
          ),
        };
        if (injured) {
          const progress = (medicalProgress[id] ?? 0) + (ops.medical.includes(id) ? 1.5 : 1);
          injuries[id] = Math.max(0, injuries[id]! - Math.floor(progress));
          medicalProgress[id] = progress % 1;
        } else if (routine === 'training') {
          const growth =
            (development[id] ?? 0) + 0.006 * center.levels.coaching * load * (individual ? 1.5 : 1);
          if (player.age <= 33 && player.overall < player.potential)
            history.growth += Math.min(
              player.potential - player.overall,
              0.006 * center.levels.coaching * load * (individual ? 1.5 : 1),
            );
          next = {
            ...next,
            overall: Math.max(
              player.overall,
              Math.min(player.potential, player.overall + Math.floor(growth)),
            ),
            fitness: Math.max(
              0,
              next.fitness - Math.ceil(load * 3 * ageFatigue * (1 + (effort[id] ?? 0) / 12)),
            ),
          };
          development[id] = growth % 1;
          if (
            random() <
            (0.001 * load * load * ageFatigue * (1 + (effort[id] ?? 0) / 6)) / center.levels.medical
          )
            injuries[id] = Math.max(1, Math.ceil(3 / center.levels.medical));
        }
        const trained = progressTraining(
          player,
          progression[id] ?? emptyTrainingProgression(),
          injured ? 'light' : setting,
          center.levels.coaching,
          !injured && routine === 'training',
          individual ? 1.5 : 1,
          Boolean(individual),
        );
        history.bonus +=
          trained.progress.buff -
          previousProgress.buff +
          trained.progress.buffProgress -
          previousProgress.buffProgress;
        if (player.age > 33)
          history.decline = Math.max(
            0,
            history.decline +
              player.overall -
              trained.overall +
              trained.progress.declineProgress -
              previousProgress.declineProgress,
          );
        progression[id] = trained.progress;
        trainingHistory[id] = history;
        if (player.age > 33) next = { ...next, overall: trained.overall };
        if (individual && day + GAME_DAY_MS >= individual.endsAt) {
          if (player.age < 33) {
            if (next.overall < next.potential)
              next = { ...next, overall: Math.min(next.potential, next.overall + 1) };
            else cycleBonuses[id] = { games: 15 };
          }
          completed.add(id);
        }
        players[id] = revalueGrowth(player, next);
      }
      centers[center.id] = {
        ...center,
        operations: {
          ...ops,
          medicalProgress,
          effort,
          progression,
          cycleBonuses,
          trainingHistory,
          individual: ops.individual.filter((plan) => !completed.has(plan.playerId)),
          medical: ops.medical.filter((id) => (injuries[id] ?? 0) > 0),
          fitness: ops.fitness.filter((id) => (players[id]?.fitness ?? 100) < 100),
        },
      };
    }
    for (const player of Object.values(players)) {
      if (player.clubId) continue;
      players[player.id] = {
        ...player,
        fitness: Math.min(100, player.fitness + GAMEPLAY.fitnessRecovery),
      };
    }
    state = { ...settleMonthly(state, day + GAME_DAY_MS), lastProcessedAt: day + GAME_DAY_MS };
  }
  return finishIndividualCycles(
    {
      ...state,
      players: { ...state.players, byId: players },
      centers: { ...state.centers, byId: centers },
      injuries,
      development,
    },
    target,
  );
}

function finishIndividualCycles(state: WorldState, at: number): WorldState {
  const expired = Object.values(state.centers.byId).filter((center) =>
    center.operations?.individual.some((plan) => plan.endsAt <= at),
  );
  if (!expired.length) return state;
  const players = { ...state.players.byId };
  const centers = { ...state.centers.byId };
  for (const center of expired) {
    const ops = center.operations!;
    const cycleBonuses = { ...ops.cycleBonuses };
    for (const plan of ops.individual.filter((plan) => plan.endsAt <= at)) {
      const player = players[plan.playerId];
      if (!player || player.clubId !== center.clubId || player.age >= 33) continue;
      if (player.overall >= player.potential) cycleBonuses[player.id] = { games: 15 };
      else
        players[player.id] = revalueGrowth(player, {
          ...player,
          overall: Math.min(player.potential, player.overall + 1),
        });
    }
    centers[center.id] = {
      ...center,
      operations: {
        ...ops,
        cycleBonuses,
        individual: ops.individual.filter((plan) => plan.endsAt > at),
      },
    };
  }
  return {
    ...state,
    centers: { ...state.centers, byId: centers },
    players: { ...state.players, byId: players },
  };
}

export function realTimeGameDate(state: WorldState, nextGameAt: number, realNow: number): number {
  const anchor = state.calendarAnchor;
  if (!state.seasonClock || !anchor || state.nextScheduledAt <= anchor.realAt)
    return state.lastProcessedAt;
  const fraction = Math.max(
    0,
    Math.min(1, (realNow - anchor.realAt) / (state.nextScheduledAt - anchor.realAt)),
  );
  return Math.max(
    state.lastProcessedAt,
    Math.min(nextGameAt, anchor.gameAt + fraction * (nextGameAt - anchor.gameAt)),
  );
}

export function advanceGameDays(state: WorldState, target: number): WorldState {
  return realizeCompetitionDraws(
    advanceGameDaysInternal(normalizeRoundCalendar(state), target),
    target,
  );
}
