import { createContext } from 'react';
import { MATCH_DURATION_MS, type MatchResult } from '@football/shared';
import { visibleActionMinute } from './match-playback';

type Action = NonNullable<MatchResult['actions']>[number];
export const GoalCelebration = createContext<'home' | 'away' | null>(null);

export function recentMatchEvent(
  actions: readonly Action[],
  minute: number,
  types: readonly Action['type'][],
  durationMs: number,
) {
  for (let index = actions.length - 1; index >= 0; index--) {
    const action = actions[index]!;
    if (!types.includes(action.type)) continue;
    const ageMs = ((minute - visibleActionMinute(actions, index)) / 90) * MATCH_DURATION_MS;
    if (ageMs >= 0 && ageMs < durationMs) return action;
  }
  return undefined;
}
