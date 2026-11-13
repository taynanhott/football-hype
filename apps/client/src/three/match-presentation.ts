import type { MatchResult } from '@football/shared';
type Action = NonNullable<MatchResult['actions']>[number];
/** All actions follow the same match clock. */
export function presentationGameMinute(_actions: readonly Action[], clockMinute: number): number {
  return Math.max(0, Math.min(90, clockMinute));
}
