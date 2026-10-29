import { COMPETITIONS, type WorldState, type Fixture } from '@football/shared';
import { cupReturnDate, competitionDates } from './season-calendar.js';
import { cupCalendarNodes } from './cup-calendar.js';
const DAY = 86400000;
const OFFSET = 10800000;
export const ROUND_REST_DAYS = 2;
export const ROUND_CALENDAR_VERSION = 5;
const day = (at: number) => Math.floor((at - OFFSET) / DAY) * DAY + OFFSET;
export const fixtureRoundKey = (fixture: Fixture) =>
  `${fixture.competitionId}:${fixture.group ? 'group' : 'league'}:${fixture.round}`;
export const cupRoundKey = (competition: string, round: number, leg: number) =>
  `${competition}:cup:${round}:${leg}`;
/** Shared round dates; only overlapping club pools block a date in another competition. */
export function normalizeRoundCalendar(state: WorldState): WorldState {
  if (
    state.roundCalendarVersion !== undefined &&
    state.roundCalendarVersion < ROUND_CALENDAR_VERSION
  ) {
    const completedIds = new Set(state.results.map((result) => result.fixtureId));
    const historicalKeys = new Set(
      state.fixtures
        .filter((f) => completedIds.has(f.id) || f.scheduledAt <= state.lastProcessedAt)
        .map(fixtureRoundKey),
    );
    for (const node of state.cups) {
      if (completedIds.has(`${node.id}:first`))
        historicalKeys.add(cupRoundKey(node.competitionId, node.round, 0));
      if (completedIds.has(node.id))
        historicalKeys.add(
          cupRoundKey(
            node.competitionId,
            node.round,
            (node.legs ?? COMPETITIONS.find((r) => r.id === node.competitionId)?.legs ?? 1) - 1,
          ),
        );
    }
    const referenceDates = new Map<string, number[]>();
    for (const id of new Set(state.cups.map((n) => n.competitionId))) {
      referenceDates.set(
        id,
        competitionDates(
          id,
          state.season,
          Math.max(...state.cups.filter((n) => n.competitionId === id).map((n) => n.round)) + 1,
          true,
        ),
      );
    }
    state = {
      ...state,
      roundDates: Object.fromEntries(
        Object.entries(state.roundDates ?? {}).filter(([key]) => historicalKeys.has(key)),
      ),
      fixtures: state.fixtures.map((f) => {
        if (
          f.scheduledAt <= state.lastProcessedAt ||
          completedIds.has(f.id) ||
          !COMPETITIONS.some((r) => r.id === f.competitionId)
        )
          return f;
        const count =
          Math.max(
            ...state.fixtures
              .filter((other) => other.competitionId === f.competitionId)
              .map((other) => other.round),
          ) + 1;
        return {
          ...f,
          scheduledAt:
            competitionDates(f.competitionId, state.season, count)[f.round] ?? f.scheduledAt,
        };
      }),
      cups: state.cups.map((n) =>
        n.scheduledAt <= state.lastProcessedAt ||
        completedIds.has(n.id) ||
        completedIds.has(`${n.id}:first`)
          ? n
          : { ...n, scheduledAt: referenceDates.get(n.competitionId)?.[n.round] ?? n.scheduledAt },
      ),
    };
  }
  const calendarNodes = cupCalendarNodes(state);
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
  for (const node of calendarNodes) {
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
  const datesMatchSources =
    state.fixtures.every((f) => state.roundDates?.[fixtureRoundKey(f)] === f.scheduledAt) &&
    state.cups.every(
      (n) => state.roundDates?.[cupRoundKey(n.competitionId, n.round, 0)] === n.scheduledAt,
    );
  if (
    state.roundCalendarVersion === ROUND_CALENDAR_VERSION &&
    datesMatchSources &&
    [...candidates.keys()].every((key) => state.roundDates?.[key] !== undefined)
  )
    return state;
  const dates = { ...state.roundDates };
  const queues = new Map<string, [string, { at: number; competition: string; order: number }][]>();
  for (const entry of candidates) {
    const queue = queues.get(entry[1].competition) ?? [];
    queue.push(entry);
    queues.set(entry[1].competition, queue);
  }
  for (const queue of queues.values()) queue.sort((a, b) => a[1].order - b[1].order);
  const participants = new Map<string, Set<string>>();
  for (const f of state.fixtures) {
    const ids = participants.get(f.competitionId) ?? new Set<string>();
    ids.add(f.homeId);
    ids.add(f.awayId);
    participants.set(f.competitionId, ids);
  }
  for (const n of state.cups) {
    const ids = participants.get(n.competitionId) ?? new Set<string>();
    if (n.homeId) ids.add(n.homeId);
    if (n.awayId) ids.add(n.awayId);
    participants.set(n.competitionId, ids);
  }
  const roundParticipants = new Map<string, Set<string>>();
  for (const f of state.fixtures) {
    const ids = roundParticipants.get(fixtureRoundKey(f)) ?? new Set<string>();
    ids.add(f.homeId);
    ids.add(f.awayId);
    roundParticipants.set(fixtureRoundKey(f), ids);
  }
  const possibleClubs = (
    node: (typeof calendarNodes)[number],
    visited = new Set<string>(),
  ): string[] => {
    if (visited.has(node.id)) return [];
    visited.add(node.id);
    if (node.winnerId) return [node.winnerId];
    const known = [node.homeId, node.awayId].filter((id): id is string => !!id);
    for (const parentId of [node.leftId, node.rightId]) {
      const parent = calendarNodes.find((n) => n.id === parentId);
      if (parent) known.push(...possibleClubs(parent, visited));
    }
    return known.length ? known : [...(participants.get(node.competitionId) ?? [])];
  };
  for (const node of calendarNodes) {
    const legs = node.legs ?? COMPETITIONS.find((r) => r.id === node.competitionId)?.legs ?? 1;
    for (let leg = 0; leg < legs; leg++) {
      const key = cupRoundKey(node.competitionId, node.round, leg);
      const ids = roundParticipants.get(key) ?? new Set<string>();
      possibleClubs(node).forEach((id) => ids.add(id));
      roundParticipants.set(key, ids);
    }
  }
  const occupied = Object.entries(dates).map(([key, at]) => ({
    key,
    at: day(at),
    competition: key.split(':')[0]!,
  }));
  const completed = new Set(state.results.map((r) => r.fixtureId));
  // Historical rounds are preserved. Old calendars are corrected only for future rounds.
  for (const f of state.fixtures.filter((f) => completed.has(f.id))) {
    const key = fixtureRoundKey(f);
    dates[key] ??= f.scheduledAt;
    occupied.push({ key, at: day(dates[key]!), competition: f.competitionId });
  }
  for (const node of state.cups) {
    if (completed.has(`${node.id}:first`)) {
      const key = cupRoundKey(node.competitionId, node.round, 0);
      dates[key] ??= node.scheduledAt;
      occupied.push({ key, at: day(dates[key]!), competition: node.competitionId });
    }
    if (completed.has(node.id)) {
      const legs = node.legs ?? COMPETITIONS.find((r) => r.id === node.competitionId)?.legs ?? 1;
      const key = cupRoundKey(node.competitionId, node.round, legs - 1);
      dates[key] ??=
        legs === 2 ? cupReturnDate(node.competitionId, node.scheduledAt) : node.scheduledAt;
      occupied.push({ key, at: day(dates[key]!), competition: node.competitionId });
    }
  }
  const previous = new Map<string, number>();
  while ([...queues.values()].some((q) => q.length)) {
    const next = [...queues.values()]
      .filter((q) => q.length)
      .sort((a, b) => {
        const prePending = (queues.get('pre-libertadores')?.length ?? 0) > 0;
        const blocked = (competition: string) =>
          prePending && ['libertadores', 'sul-americana'].includes(competition) ? 1 : 0;
        return (
          blocked(a[0]![1].competition) - blocked(b[0]![1].competition) ||
          a[0]![1].at - b[0]![1].at ||
          a[0]![0].localeCompare(b[0]![0])
        );
      })[0]!;
    const [key, item] = next.shift()!;
    if (dates[key] === undefined) {
      let at = Math.max(
        day(item.at) + 16 * 3600000,
        day(state.lastProcessedAt) + (ROUND_REST_DAYS + 1) * DAY + 16 * 3600000,
        (previous.get(item.competition) ?? -Infinity) + (ROUND_REST_DAYS + 1) * DAY,
      );
      if (['libertadores', 'sul-americana'].includes(item.competition)) {
        const preDates = Object.entries(dates)
          .filter(([key]) => key.startsWith('pre-libertadores:cup:'))
          .map(([, at]) => at);
        if (preDates.length) at = Math.max(at, Math.max(...preDates) + 3 * DAY);
      }
      while (
        occupied.some(
          (other) =>
            Math.abs(day(at) - other.at) < (ROUND_REST_DAYS + 1) * DAY &&
            (other.competition === item.competition ||
              [...(roundParticipants.get(key) ?? [])].some((id) =>
                roundParticipants.get(other.key)?.has(id),
              )),
        )
      )
        at += DAY;
      dates[key] = at;
      occupied.push({ key, at: day(at), competition: item.competition });
    }
    previous.set(item.competition, dates[key]!);
  }
  const preDates = Object.entries(dates)
    .filter(([key]) => key.startsWith('pre-libertadores:cup:'))
    .map(([, at]) => at);
  let drawChanged = false;
  const competitionDraws = state.competitionDraws?.map((draw) => {
    if (
      draw.completedAt !== undefined ||
      !['libertadores', 'sul-americana'].includes(draw.competitionId) ||
      !preDates.length
    )
      return draw;
    const at =
      day(Math.max(...preDates)) +
      DAY +
      15 * 3600000 +
      (draw.competitionId === 'sul-americana' ? DAY : 0);
    if (draw.scheduledAt === at) return draw;
    drawChanged = true;
    return { ...draw, scheduledAt: at };
  });
  if (
    !drawChanged &&
    datesMatchSources &&
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
    ...(competitionDraws ? { competitionDraws } : {}),
    roundDates: dates,
    roundCalendarVersion: ROUND_CALENDAR_VERSION,
  };
}
