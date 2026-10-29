import {
  scheduledFixtures,
  normalizeRoundCalendar,
  cupRoundKey,
  cupReturnDate,
} from '@football/domain';
import { COMPETITIONS } from '@football/shared';
import type { WorldState } from '@football/shared';

export function clubCalendarFixtures(state: WorldState, clubId: string) {
  return scheduledFixtures(state).filter(
    (fixture) =>
      (fixture.homeId === clubId || fixture.awayId === clubId) &&
      !state.competitionDraws?.some(
        (draw) => draw.competitionId === fixture.competitionId && draw.completedAt === undefined,
      ),
  );
}

/** Reserved cup dates remain visible while the draw or qualification is pending. */
export function clubCalendarPendingGames(state: WorldState, clubId: string) {
  const calendar = normalizeRoundCalendar(state);
  const fixtures = scheduledFixtures(calendar);
  const competitions = new Set(
    fixtures.filter((f) => f.homeId === clubId || f.awayId === clubId).map((f) => f.competitionId),
  );
  const entries = new Map<
    string,
    { id: string; competitionId: string; scheduledAt: number; label: string }
  >();
  const visibleFixtures = clubCalendarFixtures(calendar, clubId);
  for (const draw of calendar.competitionDraws ?? []) {
    if (draw.participantIds.includes(clubId)) competitions.add(draw.competitionId);
    if (draw.completedAt !== undefined || !draw.participantIds.includes(clubId)) continue;
    for (const fixture of fixtures.filter((f) => f.competitionId === draw.competitionId)) {
      if (fixture.scheduledAt <= state.lastProcessedAt) continue;
      const id = `${draw.competitionId}:pending:${fixture.scheduledAt}`;
      entries.set(id, {
        id,
        competitionId: draw.competitionId,
        scheduledAt: fixture.scheduledAt,
        label: 'Adversário a definir · Aguardando sorteio',
      });
    }
  }
  for (const node of calendar.cups) {
    if (!competitions.has(node.competitionId)) continue;
    const latestKnownRound = Math.max(
      -1,
      ...calendar.cups
        .filter(
          (n) =>
            n.competitionId === node.competitionId && (n.homeId === clubId || n.awayId === clubId),
        )
        .map((n) => n.round),
    );
    if (node.round < latestKnownRound) continue;
    const eliminated = calendar.cups.some(
      (n) =>
        n.competitionId === node.competitionId &&
        (n.homeId === clubId || n.awayId === clubId) &&
        n.winnerId &&
        n.winnerId !== clubId,
    );
    if (eliminated) continue;
    const legs = node.legs ?? COMPETITIONS.find((r) => r.id === node.competitionId)?.legs ?? 1;
    for (let leg = 0; leg < legs; leg++) {
      const id = cupRoundKey(node.competitionId, node.round, leg);
      const scheduledAt =
        calendar.roundDates?.[id] ??
        (leg ? cupReturnDate(node.competitionId, node.scheduledAt) : node.scheduledAt);
      if (scheduledAt <= state.lastProcessedAt) continue;
      if (
        visibleFixtures.some(
          (f) => f.competitionId === node.competitionId && f.scheduledAt === scheduledAt,
        )
      )
        continue;
      for (const [key, entry] of entries) {
        if (entry.competitionId === node.competitionId && entry.scheduledAt === scheduledAt)
          entries.delete(key);
      }
      entries.set(id, {
        id,
        competitionId: node.competitionId,
        scheduledAt,
        label: `${node.label ?? `Fase ${node.round + 1}`} · ${node.round > latestKnownRound ? 'Se classificar' : 'Adversário a definir'}${legs === 2 ? (leg ? ' · Volta' : ' · Ida') : ''}`,
      });
    }
  }
  return [...entries.values()];
}
