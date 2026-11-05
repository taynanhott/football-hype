import { it, expect } from 'vitest';
import { createWorld, stableId } from '../src/index.js';
import { scheduledFixtures } from '../src/competitions/fixtures.js';
import type { WorldState } from '@football/shared';
function pendingBefore(state: WorldState) {
  const completed = new Set(state.results.map((r) => r.fixtureId));
  const all = scheduledFixtures(state);
  return all.filter((f) => {
    if (completed.has(f.id)) return false;
    const node = state.cups.find((n) => n.id === f.id || `${n.id}:first` === f.id);
    return (
      !node ||
      (!node.winnerId &&
        (f.id.endsWith(':first') ||
          !all.some((first) => first.id === `${node.id}:first`) ||
          completed.has(`${node.id}:first`)))
    );
  });
}

import { pendingFixtures as pendingAfter } from '../src/game/play-batch.js';
it('measures pending fixture selection before and after', () => {
  const created = createWorld({
    id: stableId(997, 1),
    userId: 'host',
    name: 'Benchmark',
    mode: 'offline',
    now: Date.UTC(2026, 0, 15),
  });
  if (!created.ok) throw Error('world');
  const state = created.value;
  function measure(fn: typeof pendingBefore) {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      fn(state);
      samples.push(performance.now() - start);
    }
    return samples.sort((a, b) => a - b)[2]!;
  }
  pendingBefore(state);
  pendingAfter(state);
  const baseline = measure(pendingBefore),
    optimized = measure(pendingAfter);
  expect(pendingAfter(state)).toEqual(pendingBefore(state));
  console.log(
    JSON.stringify({
      baselineMs: baseline,
      optimizedMs: optimized,
      reductionPercent: (1 - optimized / baseline) * 100,
    }),
  );
}, 120000);
