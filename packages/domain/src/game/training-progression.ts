import { revalueGrowth } from '../players/development.js';
import type { PlayerSnapshot, WorldState } from '@football/shared';
export type TrainingLoad = 'light' | 'moderate' | 'intense';
export type TrainingProgression = { buff: number; buffProgress: number; declineProgress: number };
export const emptyTrainingProgression = (): TrainingProgression => ({
  buff: 0,
  buffProgress: 0,
  declineProgress: 0,
});
export function annualDecline(age: number, load: TrainingLoad, coaching: number) {
  return age > 33
    ? ((load === 'light' ? 3 : load === 'moderate' ? 1 : 0) * (1 + (age - 34) * 0.12)) /
        (1 + (coaching - 1) * 0.1)
    : 0;
}
export function progressTraining(
  player: PlayerSnapshot,
  previous: TrainingProgression,
  load: TrainingLoad,
  coaching: number,
  trainingDay: boolean,
  bonusFactor = 1,
  individualCycle = false,
) {
  const progress = { ...previous };
  let overall = player.overall;
  if (player.age > 33) {
    progress.declineProgress = individualCycle
      ? Math.max(0, previous.declineProgress - 0.02 * (1 + (coaching - 1) * 0.1))
      : previous.declineProgress + annualDecline(player.age, load, coaching) / 365;
    const lost = Math.floor(progress.declineProgress);
    overall = Math.max(1, overall - lost);
    progress.declineProgress -= lost;
  } else if (player.overall >= player.potential && trainingDay) {
    progress.buffProgress = Math.max(
      0,
      progress.buffProgress +
        (load === 'intense'
          ? 0.004 * (1 + (coaching - 1) * 0.1) * bonusFactor
          : load === 'light'
            ? -0.004
            : 0),
    );
    if (progress.buffProgress >= 1 && progress.buff < 3) {
      progress.buff++;
      progress.buffProgress -= 1;
    }
    if (progress.buff >= 3) progress.buffProgress = 1;
  }
  return { progress, overall };
}

export function officialMatchDevelopment(
  player: PlayerSnapshot,
  development: number,
  previous: TrainingProgression,
  coaching: number,
  individual: boolean,
) {
  const multiplier = individual ? 1.5 : 1;
  const trained = progressTraining(
    player,
    previous,
    'intense',
    coaching,
    player.age <= 33,
    multiplier,
  );
  const growth =
    player.age <= 33 && player.overall < player.potential
      ? development + 0.006 * coaching * 1.5 * multiplier
      : development;
  const overall =
    player.age <= 33
      ? Math.min(player.potential, player.overall + Math.floor(growth))
      : player.overall;
  return {
    player: revalueGrowth(player, { ...player, overall: Math.max(player.overall, overall) }),
    development: growth % 1,
    progression: trained.progress,
  };
}

export type TrainingHistory = {
  season: number;
  days: number;
  growth: number;
  bonus: number;
  decline: number;
};
export function currentTrainingHistory(
  record: TrainingHistory | undefined,
  season: number,
): TrainingHistory {
  return record?.season === season
    ? { ...record }
    : { season, days: 0, growth: 0, bonus: 0, decline: 0 };
}
export function expectedTrainingGain(state: WorldState, player: PlayerSnapshot): number {
  const center = state.centers.byId[state.clubs.byId[player.clubId ?? '']?.trainingCenterId ?? ''];
  const record = center?.operations?.trainingHistory?.[player.id];
  if (!record || record.season !== state.season || record.days <= 0) return 0;
  const seasonEnd = Date.UTC(state.season + 1, 0, 1);
  const remaining = Math.max(0, Math.ceil((seasonEnd - state.lastProcessedAt) / 86400000));
  const factor = 1 + remaining / record.days;
  if (player.age > 33) return -record.decline * factor;
  if (player.overall >= player.potential) return Math.max(0, Math.min(3, record.bonus * factor));
  return Math.max(
    0,
    Math.min(record.growth * factor, record.growth + player.potential - player.overall),
  );
}
