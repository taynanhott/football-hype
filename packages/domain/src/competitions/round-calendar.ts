import { COMPETITIONS, type WorldState, type Fixture } from '@football/shared';
import { cupReturnDate } from './season-calendar.js';
const DAY = 86400000;
const OFFSET = 10800000;
export const ROUND_REST_DAYS = 2;
export const ROUND_CALENDAR_VERSION = 1;
const day = (at: number) => Math.floor((at - OFFSET) / DAY) * DAY + OFFSET;
export const fixtureRoundKey = (fixture: Fixture) =>
  `${fixture.competitionId}:${fixture.group ? 'group' : 'league'}:${fixture.round}`;
export const cupRoundKey = (competition: string, round: number, leg: number) =>
  `${competition}:cup:${round}:${leg}`;
/** Reserve a separate date for every complete round, including unresolved bracket nodes. */
export function normalizeRoundCalendar(state: WorldState): WorldState {
  const candidates = new Map<string, { at: number; competition: string; order: number }>();
  for (const f of state.fixtures) {
    const key = fixtureRoundKey(f);
    const old = candidates.get(key);
    candidates.set(key, {
      at: Math.min(old?.at ?? Infinity, f.scheduledAt),
      competition: f.competitionId,
      order: f.round,
    });
  }
  for (const node of state.cups) {
    const legs = node.legs ?? COMPETITIONS.find((r) => r.id === node.competitionId)?.legs ?? 1;
    for (let leg = 0; leg < legs; leg++) {
      const key = cupRoundKey(node.competitionId, node.round, leg);
      const at = leg ? cupReturnDate(node.competitionId, node.scheduledAt) : node.scheduledAt;
      const old = candidates.get(key);
      candidates.set(key, {
        at: Math.min(old?.at ?? Infinity, at),
        competition: node.competitionId,
        order: 1000 + node.round * 2 + leg,
      });
    }
  }
  const dates = { ...state.roundDates };
  const queues = new Map<string, [string, { at: number; competition: string; order: number }][]>();
  for (const entry of candidates) {
    const queue = queues.get(entry[1].competition) ?? [];
    queue.push(entry);
    queues.set(entry[1].competition, queue);
  }
  for (const queue of queues.values()) queue.sort((a, b) => a[1].order - b[1].order);
  const occupied = Object.values(dates).map(day);
  const completed = new Set(state.results.map((r) => r.fixtureId));
  // Historical rounds are preserved. Old calendars are corrected only for future rounds.
  for (const f of state.fixtures.filter((f) => completed.has(f.id))) {
    const key = fixtureRoundKey(f);
    dates[key] ??= f.scheduledAt;
    occupied.push(day(dates[key]!));
  }
  for (const node of state.cups) {
    if (completed.has(`${node.id}:first`)) {
      const key = cupRoundKey(node.competitionId, node.round, 0);
      dates[key] ??= node.scheduledAt;
      occupied.push(day(dates[key]!));
    }
    if (completed.has(node.id)) {
      const legs = node.legs ?? COMPETITIONS.find((r) => r.id === node.competitionId)?.legs ?? 1;
      const key = cupRoundKey(node.competitionId, node.round, legs - 1);
      dates[key] ??=
        legs === 2 ? cupReturnDate(node.competitionId, node.scheduledAt) : node.scheduledAt;
      occupied.push(day(dates[key]!));
    }
  }
  const previous = new Map<string, number>();
  while ([...queues.values()].some((q) => q.length)) {
    const next = [...queues.values()]
      .filter((q) => q.length)
      .sort((a, b) => a[0]![1].at - b[0]![1].at || a[0]![0].localeCompare(b[0]![0]))[0]!;
    const [key, item] = next.shift()!;
    if (dates[key] === undefined) {
      let at = Math.max(
        day(item.at) + 16 * 3600000,
        day(state.lastProcessedAt) + (ROUND_REST_DAYS + 1) * DAY + 16 * 3600000,
        (previous.get(item.competition) ?? -Infinity) + (ROUND_REST_DAYS + 1) * DAY,
      );
      while (occupied.some((other) => Math.abs(day(at) - other) < (ROUND_REST_DAYS + 1) * DAY))
        at += DAY;
      dates[key] = at;
      occupied.push(day(at));
    }
    previous.set(item.competition, dates[key]!);
  }
  if (
    state.roundCalendarVersion === ROUND_CALENDAR_VERSION &&
    Object.keys(dates).length === Object.keys(state.roundDates ?? {}).length
  )
    return state;
  return {
    ...state,
    fixtures: state.fixtures.map((f) => ({
      ...f,
      scheduledAt: dates[fixtureRoundKey(f)] ?? f.scheduledAt,
    })),
    cups: state.cups.map((node) => ({
      ...node,
      scheduledAt: dates[cupRoundKey(node.competitionId, node.round, 0)] ?? node.scheduledAt,
    })),
    roundDates: dates,
    roundCalendarVersion: ROUND_CALENDAR_VERSION,
  };
}
