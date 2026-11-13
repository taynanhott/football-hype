import { GAMEPLAY } from '@football/shared';

/** Shared displayed value for lineup cards and squad averages. */
export function fitnessOverall(overall: number, fitness: number) {
  const fatigue = 100 - Math.min(100, Math.max(0, fitness));
  const penalty = Math.round((overall * fatigue) / (GAMEPLAY.fitnessScale * 2));
  return Math.max(1, overall - penalty);
}
