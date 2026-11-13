import { afterEach, expect, it, vi } from 'vitest';
import { MATCH_DURATION_MS } from '@football/shared';

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => boolean) => getSnapshot(),
}));
import { useSimulationNavigationLock } from '../src/ui/use-simulation-navigation-lock';

afterEach(() => vi.useRealTimers());

it('não bloqueia novamente a navegação quando o relógio é sincronizado após o fim', () => {
  vi.useFakeTimers();
  const start = 100000;
  vi.setSystemTime(start);
  expect(useSimulationNavigationLock(start, 0)).toBe(true);
  vi.setSystemTime(start + MATCH_DURATION_MS + 5000);
  expect(useSimulationNavigationLock(start, 100)).toBe(false);
  expect(useSimulationNavigationLock(undefined, 0)).toBe(false);
});
