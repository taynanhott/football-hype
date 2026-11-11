import {
  cupCalendarNodes,
  cupReturnDate,
  scheduledFixtures,
  normalizeRoundCalendar,
  seasonStart,
  nextPlayingTime,
  SEASON_EVENT_GAP_MS,
  seasonClosingDates,
  pendingSeasonClosingDates,
} from '@football/domain';
import type { WorldState } from '@football/shared';

/** Reserved dates include the last possible cup legs and the final world match. */
export function seasonCalendarMilestones(state: WorldState) {
  if (state.seasonClosing) {
    const closing =
      state.status === 'finished'
        ? state.seasonClosing
        : pendingSeasonClosingDates(state.seasonClosing);
    return {
      start: seasonStart(state.season),
      end: closing.lastMatchAt,
      payment: closing.paymentAt,
      gala: closing.galaAt,
      seasonEnd: closing.endAt,
      confirmed: true,
    };
  }
  const calendar = normalizeRoundCalendar(state);
  const dates = scheduledFixtures(calendar).map((f) => f.scheduledAt);
  const nodes = cupCalendarNodes(calendar);
  for (const n of nodes)
    dates.push((n.legs ?? 1) === 2 ? cupReturnDate(n.competitionId, n.scheduledAt) : n.scheduledAt);
  const latest = Math.max(state.lastProcessedAt, ...dates);
  const worldFinal = state.cups.find((c) => c.competitionId === 'intercontinental');
  const end =
    state.status === 'finished'
      ? state.lastProcessedAt
      : worldFinal
        ? latest
        : nextPlayingTime(latest + SEASON_EVENT_GAP_MS);
  const closing = seasonClosingDates(end);
  return {
    start: seasonStart(state.season),
    end,
    payment: closing.paymentAt,
    gala: closing.galaAt,
    seasonEnd: closing.endAt,
    confirmed: state.status === 'finished',
  };
}
export function seasonAwardsCalendarDate(state: WorldState): { at: number; confirmed: boolean } {
  const dates = seasonCalendarMilestones(state);
  return { at: dates.gala, confirmed: dates.confirmed };
}
