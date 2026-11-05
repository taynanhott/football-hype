import { useEffect, useState } from 'react';
import { MATCH_DURATION_MS } from '@football/shared';

export function useSimulationNavigationLock(startedAt: number | undefined, clockOffset: number) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = startedAt === undefined ? 0 : startedAt + MATCH_DURATION_MS - clockOffset;
  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [endsAt]);
  return endsAt > now;
}
