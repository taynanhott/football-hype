import { describe, expect, it } from 'vitest';
import { clubCalendarCurrentTime } from '../src/features/competitions/club-calendar-fixtures';

describe('calendar current day', () => {
  const fixtures = [
    { id: 'played', scheduledAt: 200 },
    { id: 'future', scheduledAt: 400 },
  ];
  it('never marks a day before a completed match, including older saved careers', () => {
    expect(clubCalendarCurrentTime({ lastProcessedAt: 100, results: [] }, fixtures)).toBe(100);
    expect(
      clubCalendarCurrentTime({ lastProcessedAt: 100, results: [] }, fixtures, new Set(['played'])),
    ).toBe(200);
  });
  it('keeps later calendar progress and does not jump to an unplayed fixture', () => {
    expect(
      clubCalendarCurrentTime({ lastProcessedAt: 300, results: [] }, fixtures, new Set(['played'])),
    ).toBe(300);
  });
});
