import { GAMEPLAY, type Fixture } from '@football/shared';
import { PriorityQueue } from './priority-queue.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const BRAZIL_OFFSET_MINUTES = 180;

export function brazilMinute(timestamp: number): number {
  const shifted = new Date(timestamp - BRAZIL_OFFSET_MINUTES * MINUTE_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}
export function isPlayingWindow(timestamp: number): boolean {
  const minute = brazilMinute(timestamp);
  return minute >= GAMEPLAY.dailyStartMinute && minute <= GAMEPLAY.dailyEndMinute;
}
export function isFifaWindow(timestamp: number): boolean {
  const day = new Date(timestamp - BRAZIL_OFFSET_MINUTES * MINUTE_MS).toISOString().slice(0, 10);
  return GAMEPLAY.fifaWindows.some(
    (window) => day.slice(5) >= window.start.slice(5) && day.slice(5) <= window.end.slice(5),
  );
}
export function nextPlayingTime(timestamp: number): number {
  if (isPlayingWindow(timestamp)) return timestamp;
  const day = Math.floor((timestamp - BRAZIL_OFFSET_MINUTES * MINUTE_MS) / DAY_MS) * DAY_MS;
  const nextDay = brazilMinute(timestamp) > GAMEPLAY.dailyEndMinute ? DAY_MS : 0;
  return day + nextDay + (GAMEPLAY.dailyStartMinute + BRAZIL_OFFSET_MINUTES) * MINUTE_MS;
}
export function calendarDates(start: number, count: number, cup = false): readonly number[] {
  const dates: number[] = [];
  let day = Math.floor((start - BRAZIL_OFFSET_MINUTES * MINUTE_MS) / DAY_MS) * DAY_MS;
  while (dates.length < count) {
    const weekday = new Date(day).getUTCDay();
    const timestamp =
      day +
      ((cup ? GAMEPLAY.cupKickoffMinute : GAMEPLAY.leagueKickoffMinute) + BRAZIL_OFFSET_MINUTES) *
        MINUTE_MS;
    if (timestamp > start && (cup ? weekday === 3 : weekday === 0) && !isFifaWindow(timestamp))
      dates.push(timestamp);
    day += DAY_MS;
  }
  return Object.freeze(dates);
}
export function dueFixtures(fixtures: readonly Fixture[], now: number): readonly Fixture[] {
  const heap = new PriorityQueue<Fixture>(
    (a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id),
  );
  fixtures.forEach((fixture) => heap.push(fixture));
  const result: Fixture[] = [];
  while (heap.peek() && (heap.peek()?.scheduledAt ?? Infinity) <= now) {
    const fixture = heap.pop();
    if (fixture) result.push(fixture);
  }
  return Object.freeze(result);
}
