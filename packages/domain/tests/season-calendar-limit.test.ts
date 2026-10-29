import { expect, it } from 'vitest';
import { createWorld, normalizeRoundCalendar } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

it('keeps a new 2026 season within its year and normalization stable', () => {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Calendário',
      mode: 'multiplayer',
      now: Date.UTC(2026, 0, 11, 12),
    }),
  );
  const calendar = normalizeRoundCalendar(state);
  expect(Math.max(...Object.values(calendar.roundDates ?? {}))).toBeLessThan(
    Date.UTC(2027, 0, 1, 3),
  );
  expect(normalizeRoundCalendar(calendar)).toBe(calendar);
});
