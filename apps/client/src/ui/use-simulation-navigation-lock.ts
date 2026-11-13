import { useCallback, useSyncExternalStore } from 'react';
import { MATCH_DURATION_MS } from '@football/shared';

export function useSimulationNavigationLock(startedAt: number | undefined, clockOffset: number) {
  const endsAt = startedAt === undefined ? 0 : startedAt + MATCH_DURATION_MS - clockOffset;
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!endsAt) return () => {};
      const timer = window.setTimeout(notify, Math.max(0, endsAt - Date.now()));
      return () => window.clearTimeout(timer);
    },
    [endsAt],
  );
  const getSnapshot = useCallback(() => endsAt > Date.now(), [endsAt]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
