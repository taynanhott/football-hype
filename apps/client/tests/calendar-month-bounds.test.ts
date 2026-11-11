import { describe, it, expect } from 'vitest';
import {
  calendarMonthBounds,
  boundedCalendarMonth,
} from '../src/features/competitions/calendar-month-bounds';
describe('limites de meses da carreira', () => {
  const bounds = calendarMonthBounds({
    createdAt: Date.parse('2026-01-11T11:00:00Z'),
    season: 2028,
    seasonArchives: [],
  });
  it('permite só anos entre a criação e a temporada atual', () => {
    expect(bounds).toEqual({ min: 2026 * 12, max: 2028 * 12 + 11 });
    expect(
      boundedCalendarMonth(new Date('2025-12-01T12:00:00Z'), bounds).toISOString().slice(0, 7),
    ).toBe('2026-01');
    expect(
      boundedCalendarMonth(new Date('2029-01-01T12:00:00Z'), bounds).toISOString().slice(0, 7),
    ).toBe('2028-12');
  });
  it('preserva os meses dentro da faixa', () => {
    expect(
      boundedCalendarMonth(new Date('2027-07-15T12:00:00Z'), bounds).toISOString().slice(0, 7),
    ).toBe('2027-07');
  });
});
