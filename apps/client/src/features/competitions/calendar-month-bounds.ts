import type { WorldState } from '@football/shared';
export function calendarMonthBounds(
  state: Pick<WorldState, 'season' | 'createdAt' | 'seasonArchives'>,
) {
  const creationYear = new Date(state.createdAt).getUTCFullYear();
  const firstSeason = Math.min(
    state.season,
    creationYear,
    ...(state.seasonArchives ?? []).map((a) => a.season),
  );
  return { min: firstSeason * 12, max: state.season * 12 + 11 };
}
export function boundedCalendarMonth(date: Date, bounds: { min: number; max: number }) {
  const value = Math.max(
    bounds.min,
    Math.min(bounds.max, date.getUTCFullYear() * 12 + date.getUTCMonth()),
  );
  return new Date(Date.UTC(Math.floor(value / 12), value % 12, 1, 12));
}
