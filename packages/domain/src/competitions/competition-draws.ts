import { COMPETITIONS, knockoutLegs, type WorldState } from '@football/shared';
import { groupFixtures } from './cup-groups.js';
import { buildBracket } from './knockout.js';
import { competitionDates } from './season-calendar.js';
import { shuffleCupParticipants } from './fixed-participants.js';
import { normalizeRoundCalendar } from './round-calendar.js';
import { resolveRegionalQualifiers } from './regional-qualifiers.js';
/** Persist a draw once its season date is reached. No reroll on reconnect or restart. */
export function realizeCompetitionDraws(state: WorldState, target: number): WorldState {
  let next = resolveRegionalQualifiers(state);
  for (const draw of next.competitionDraws ?? []) {
    if (draw.completedAt !== undefined || draw.scheduledAt > target) continue;
    if (
      next.regionalQualifiers?.some(
        (q) => q.cupId === draw.competitionId && q.qualifiedIds === undefined,
      )
    )
      continue;
    const pre = next.cups.filter((n) => n.competitionId === 'pre-libertadores');
    const continental = ['libertadores', 'sul-americana'].includes(draw.competitionId);
    if (continental && pre.some((n) => !n.winnerId)) continue;
    let ids = [...draw.participantIds];
    if (continental && pre.length) {
      const entrants = new Set(
        pre.flatMap((n) => [n.homeId, n.awayId]).filter((id): id is string => Boolean(id)),
      );
      const qualified = pre.map((n) =>
        draw.competitionId === 'libertadores'
          ? n.winnerId!
          : n.winnerId === n.homeId
            ? n.awayId!
            : n.homeId!,
      );
      ids = [...ids.filter((id) => !entrants.has(id)), ...qualified];
    }
    const shuffled = shuffleCupParticipants(ids, draw.seed, draw.competitionId);
    const rule = COMPETITIONS.find((r) => r.id === draw.competitionId);
    if (!rule) continue;
    let fixtures = next.fixtures;
    let cups = next.cups;
    if (draw.kind === 'groups') {
      const current = fixtures.filter((f) => f.competitionId === draw.competitionId);
      const reference = competitionDates(draw.competitionId, next.season, 6);
      const dates = reference.map((at, round) =>
        Math.min(...current.filter((f) => f.round === round).map((f) => f.scheduledAt), at),
      );
      fixtures = [
        ...fixtures.filter((f) => f.competitionId !== draw.competitionId),
        ...groupFixtures(shuffled, draw.competitionId, dates, 2),
      ];
    } else if (draw.competitionId !== 'pre-libertadores') {
      const rounds = Math.log2(shuffled.length);
      const bracket = buildBracket(
        shuffled,
        draw.competitionId,
        competitionDates(draw.competitionId, next.season, rounds, true),
      );
      if (!bracket.ok) throw new Error(bracket.error.message);
      cups = [
        ...cups.filter((n) => n.competitionId !== draw.competitionId),
        ...bracket.value.map((n) => ({
          ...n,
          legs: knockoutLegs(draw.competitionId, n.round, rounds - 1),
        })),
      ];
    }
    next = {
      ...next,
      fixtures,
      cups,
      competitionDraws: next.competitionDraws!.map((item) =>
        item.id === draw.id
          ? { ...item, participantIds: ids, completedAt: draw.scheduledAt }
          : item,
      ),
    };
  }
  return next === state ? state : normalizeRoundCalendar({ ...next, roundCalendarVersion: 0 });
}
