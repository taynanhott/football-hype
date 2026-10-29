import { COMPETITIONS, knockoutLegs, type WorldState } from '@football/shared';
import { groupFixtures } from './cup-groups.js';
import { competitionDates } from './season-calendar.js';
import { fixedCupParticipants } from './fixed-participants.js';
import { roundRobin } from './round-robin.js';
const regional = new Set(['copa-nordeste', 'copa-verde', 'copa-sul-sudeste']);
/** Upgrade only competitions without any played fixture, preserving every result. */
export function upgradeUnstartedCompetitions(state: WorldState): WorldState {
  let fixtures = state.fixtures;
  let cups = state.cups;
  const changed = new Set<string>();
  const played = new Set(state.results.map((r) => r.fixtureId));
  if (
    state.regionalQualifiers?.length &&
    state.lastProcessedAt <= Date.UTC(state.season, 2, 1, 23, 59) &&
    !fixtures.some((f) => f.competitionId === 'serie-d')
  ) {
    const ids = state.clubs.ids.filter(
      (id) => state.clubs.byId[id]?.country === 'BR' && state.clubs.byId[id]?.division === 'D',
    );
    const league = roundRobin(ids, 2);
    if (league.ok) {
      const dates = competitionDates(
        'serie-d',
        state.season,
        Math.max(...league.value.map((f) => f.round)) + 1,
      );
      fixtures = [
        ...fixtures,
        ...league.value.map((f) => ({
          ...f,
          id: `serie-d:${f.round}:${f.homeId}`,
          competitionId: 'serie-d',
          scheduledAt: Math.max(
            dates[f.round]!,
            state.lastProcessedAt + 3 * 86400000 + f.round * 3 * 86400000,
          ),
        })),
      ];
      changed.add('serie-d');
    }
  }
  for (const id of ['libertadores', 'sul-americana', ...regional]) {
    if (!regional.has(id) && state.competitionDraws?.some((draw) => draw.competitionId === id))
      continue;
    const current = fixtures.filter((f) => f.competitionId === id && f.group);
    if (
      !current.length ||
      current.some((f) => played.has(f.id)) ||
      cups.some(
        (n) =>
          n.competitionId === id && (n.winnerId || played.has(n.id) || played.has(`${n.id}:first`)),
      )
    )
      continue;
    const members = [...new Set(current.flatMap((f) => [f.homeId, f.awayId]))];
    const valid =
      members.length === 16 &&
      new Set(current.map((f) => f.group)).size === 4 &&
      current.every((f) => ['A', 'B', 'C', 'D'].includes(f.group!)) &&
      members.every(
        (club) =>
          current.filter((f) => f.homeId === club || f.awayId === club).length === 6 &&
          (!regional.has(id) || state.clubs.byId[club]?.division !== 'A'),
      );
    if (valid) continue;
    const allowed = (club: string) =>
      Boolean(state.clubs.byId[club]) &&
      (!regional.has(id) ||
        (state.clubs.byId[club]!.country === 'BR' && state.clubs.byId[club]!.division !== 'A'));
    const users = new Set(state.participants.map((p) => p.clubId));
    const eligible = members
      .filter(allowed)
      .sort((a, b) => Number(users.has(b)) - Number(users.has(a)));
    const pool = regional.has(id) ? state.clubs.ids.filter(allowed) : [];
    const preferred = regional.has(id)
      ? (fixedCupParticipants(Object.values(state.clubs.byId), id)?.participants ?? [])
      : [];
    const selected = [...new Set([...eligible, ...preferred, ...pool])].slice(0, 16);
    if (selected.length !== 16) continue;
    const dates = competitionDates(id, state.season, 6);
    fixtures = [
      ...fixtures.filter((f) => f.competitionId !== id),
      ...groupFixtures(selected, id, dates, 2),
    ];
    cups = cups.filter((n) => n.competitionId !== id);
    changed.add(id);
  }
  cups = cups.map((node) => {
    if (
      !['libertadores', 'copa-brasil', ...regional].includes(node.competitionId) ||
      node.winnerId ||
      played.has(node.id) ||
      played.has(`${node.id}:first`)
    )
      return node;
    const rule = COMPETITIONS.find((r) => r.id === node.competitionId);
    if ((node.legs ?? rule?.legs) === 1) return node;
    changed.add(node.competitionId);
    return { ...node, legs: knockoutLegs(node.competitionId, node.round, node.round) };
  });
  if (!changed.size) return state;
  const roundDates = Object.fromEntries(
    Object.entries(state.roundDates ?? {}).filter(
      ([key]) => ![...changed].some((id) => key.startsWith(id + ':')),
    ),
  );
  const competitionDraws = state.competitionDraws?.map((draw) =>
    changed.has(draw.competitionId) && regional.has(draw.competitionId)
      ? {
          ...draw,
          participantIds: [
            ...new Set(
              fixtures
                .filter((f) => f.competitionId === draw.competitionId)
                .flatMap((f) => [f.homeId, f.awayId]),
            ),
          ],
        }
      : draw,
  );
  return {
    ...state,
    fixtures,
    cups,
    roundDates,
    ...(competitionDraws ? { competitionDraws } : {}),
    roundCalendarVersion: 0,
  };
}
