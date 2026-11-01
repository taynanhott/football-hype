import { useEffect, useState } from 'react';
import { MATCH_DURATION_MS, type WorldState } from '@football/shared';
import { useGameStore } from '../store/game-store';

/** One wakeup per final whistle; calendar views never expose precomputed scores. */
export function useFinishedResults(state: WorldState): WorldState {
  const offset = useGameStore((s) => s.clockOffset);
  const [tick, setTick] = useState(Date.now);
  const now = tick + offset;
  const visible = state.results.filter(
    (r) => !r.startedAt || r.startedAt + MATCH_DURATION_MS <= now,
  );
  const next = state.results.reduce((first, r) => {
    const end = r.startedAt ? r.startedAt + MATCH_DURATION_MS : 0;
    return end > now ? Math.min(first, end) : first;
  }, Infinity);
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => setTick(Date.now()),
      Math.max(0, next - Date.now() - offset) + 25,
    );
    return () => clearTimeout(timer);
  }, [next, offset]);
  return visible.length === state.results.length ? state : { ...state, results: visible };
}
