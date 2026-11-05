import { expect, it } from 'vitest';
import { nextPlannedWake } from '../src/wake-policy';

it('aguarda o fim da partida antes de processar treinos ou outra rodada', () => {
  const plan = {
    active: true,
    nextScheduledAt: 5000,
    playingUntil: 9000,
    calendarAnchor: { realAt: 0, gameAt: 0 },
    fixtureAt: 864000000,
    seasonClock: true,
    lastProcessedAt: 0,
    targets: [],
  };
  expect(nextPlannedWake(plan, 1000)).toBe(9000);
  expect(nextPlannedWake(plan, 6000)).toBe(9000);
});
