import { resolveLineup } from './tactics.js';
import { COMPETITIONS, formationSchema, type WorldState } from '@football/shared';
import { standings } from '../competitions/standings.js';
import { failure, success } from '../core/result.js';
import { domainError } from '../core/domain-error.js';

const tables = new WeakMap<WorldState, Map<string, ReturnType<typeof standings>>>();
export function coachTable(state: WorldState, clubId: string) {
  const club = state.clubs.byId[clubId];
  const key = club?.country + ':' + club?.division;
  const cached = tables.get(state)?.get(key);
  if (cached) return cached;
  const ids = state.clubs.ids.filter((id) => {
    const other = state.clubs.byId[id];
    return other?.country === club?.country && other?.division === club?.division;
  });
  const fixtures = state.fixtures.filter(
    (f) =>
      ids.includes(f.homeId) &&
      ids.includes(f.awayId) &&
      f.competitionId === COMPETITIONS.find((c) => c.division === club?.division)?.id,
  );
  const table = standings(ids, fixtures, state.results);
  const cache = tables.get(state) ?? new Map();
  cache.set(key, table);
  tables.set(state, cache);
  return table;
}
export function coachEligible(state: WorldState, fromId: string, toId: string) {
  const from = state.clubs.byId[fromId],
    to = state.clubs.byId[toId];
  if (
    !from ||
    !to ||
    fromId === toId ||
    from.country !== 'BR' ||
    to.country !== 'BR' ||
    state.participants.some((p) => p.clubId === toId) ||
    Object.values(state.returningClubs ?? {}).includes(toId)
  )
    return false;
  const own = coachTable(state, fromId),
    target = coachTable(state, toId);
  const row = target.find((r) => r.id === toId),
    current = own.find((r) => r.id === fromId);
  if (
    !row ||
    !current ||
    current.played < 19 ||
    row.played < 19 ||
    row.points >= row.played ||
    target.findIndex((r) => r.id === toId) < target.length / 2
  )
    return false;
  const divisions = ['A', 'B', 'C', 'D'];
  const level = divisions.indexOf(from.division),
    next = divisions.indexOf(to.division);
  return (
    level >= 0 &&
    (level === next ||
      (next === level - 1 &&
        own.findIndex((r) => r.id === fromId) < own.length / 2 &&
        current.points >= current.played * 1.5))
  );
}
export function generateCoachOffers(state: WorldState): WorldState {
  let offers = (state.coachOffers ?? []).map((o) =>
    o.status === 'pending' &&
    (o.season !== state.season || !coachEligible(state, o.fromClubId, o.clubId))
      ? { ...o, status: 'expired' as const }
      : o,
  );
  for (const member of state.participants) {
    const previous = offers.filter((o) => o.userId === member.userId && o.season === state.season);
    if (previous.some((o) => o.status === 'accepted')) continue;
    const row = coachTable(state, member.clubId).find((r) => r.id === member.clubId);
    if (!row || row.played < (previous.length ? 29 : 19) || previous.length >= 2) continue;
    const candidate = state.clubs.ids.find(
      (id) => coachEligible(state, member.clubId, id) && !previous.some((o) => o.clubId === id),
    );
    if (candidate)
      offers = [
        ...offers,
        {
          id: `coach-${state.season}-${member.userId}-${previous.length}`,
          userId: member.userId,
          fromClubId: member.clubId,
          clubId: candidate,
          season: state.season,
          status: 'pending',
        },
      ];
  }
  return JSON.stringify(offers) === JSON.stringify(state.coachOffers ?? [])
    ? state
    : { ...state, coachOffers: offers };
}
/** Only persisted career offers are available for a decision. */
export function pendingCoachOffers(state: WorldState, userId: string) {
  const member = state.participants.find((p) => p.userId === userId);
  const saved = state.coachOffers ?? [];
  if (!member || state.clubs.byId[member.clubId]?.country !== 'BR') return [];
  if (
    saved.some((o) => o.userId === userId && o.season === state.season && o.status === 'accepted')
  )
    return [];
  return saved.filter(
    (o) =>
      !o.id.startsWith('coach-test-') &&
      o.userId === userId &&
      o.fromClubId === member.clubId &&
      o.season === state.season &&
      o.status === 'pending',
  );
}
export function resolveCoachOffer(
  state: WorldState,
  userId: string,
  offerId: string,
  accept: boolean,
) {
  const available = pendingCoachOffers(state, userId);
  const offer = available.find(
    (o) => o.id === offerId && o.userId === userId && o.status === 'pending',
  );
  const member = state.participants.find((p) => p.userId === userId);
  if (
    !offer ||
    !member ||
    offer.season !== state.season ||
    member.clubId !== offer.fromClubId ||
    (accept &&
      (state.clubs.byId[member.clubId]?.country !== 'BR' ||
        state.clubs.byId[offer.clubId]?.country !== 'BR')) ||
    (accept && !coachEligible(state, member.clubId, offer.clubId)) ||
    (accept && state.participants.some((p) => p.clubId === offer?.clubId))
  )
    return failure(
      domainError('VALIDATION_ERROR', 'Esta proposta de treinador não está mais disponível.'),
    );
  const old = state.clubs.byId[member.clubId]!,
    target = state.clubs.byId[offer.clubId]!;
  return success({
    next: {
      ...(accept ? handOverClubs(state, old.id, target.id) : state),
      participants: accept
        ? state.participants.map((p) =>
            p.userId === userId ? { ...p, clubId: target.id, ready: false } : p,
          )
        : state.participants,
      clubs: accept
        ? {
            ...state.clubs,
            byId: {
              ...state.clubs.byId,
              [old.id]: { ...old, coachName: target.coachName },
              [target.id]: { ...target, coachName: member.coach?.name ?? old.coachName },
            },
          }
        : state.clubs,
      coachOffers: [
        ...(state.coachOffers ?? []),
        ...available.filter((o) => !state.coachOffers?.some((saved) => saved.id === o.id)),
      ].map((o) =>
        o.id === offerId
          ? {
              ...o,
              status: accept ? ('accepted' as const) : ('rejected' as const),
              ...(accept
                ? {
                    announcement: {
                      at: state.lastProcessedAt,
                      coachName: member.coach?.name ?? old.coachName ?? 'O treinador',
                      previousCoachName: target.coachName ?? 'O técnico anterior',
                      fromClubName: old.name,
                      clubName: target.name,
                    },
                  }
                : {}),
            }
          : o.userId === userId && o.status === 'pending' && accept
            ? { ...o, status: 'rejected' as const }
            : o,
      ),
    },
    type: 'league.updated' as const,
    message: accept ? `Você assumiu o ${target.name}.` : 'Proposta de treinador recusada.',
    amount: 0,
  });
}

/** Reset only future decisions; completed deals, finances and match history stay intact. */
function handOverClubs(state: WorldState, oldId: string, targetId: string): WorldState {
  const affected = new Set([oldId, targetId]);
  const tactics = { ...state.tactics };
  const presets = { ...state.lineupPresets };
  for (const id of affected) {
    delete tactics[id];
    delete presets[id];
  }
  let next: WorldState = {
    ...state,
    tactics,
    lineupPresets: presets,
    negotiations: state.negotiations.map((o) =>
      (affected.has(o.buyerId) || (!!o.sellerId && affected.has(o.sellerId))) &&
      (o.status === 'review' || o.status === 'salary')
        ? {
            ...o,
            status: 'rejected',
            withdrawn: true,
            reply: 'Negociação encerrada após mudança de treinador.',
          }
        : o,
    ),
    ...(state.management
      ? {
          management: {
            ...state.management,
            ...(state.management.offers
              ? {
                  offers: state.management.offers.map((o) =>
                    o.status === 'pending' && (affected.has(o.buyerId) || affected.has(o.sellerId))
                      ? { ...o, status: 'rejected' as const }
                      : o,
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
  const club = state.clubs.byId[oldId]!;
  let bestScore = -Infinity;
  for (const formation of formationSchema.options) {
    const entries = resolveLineup(
      next,
      club,
      state.lastProcessedAt,
      state.players.byId,
      formation,
      [],
      'balanced',
    );
    const starters = entries.flatMap((e) => (e.player ? [e.player.id] : []));
    if (starters.length !== 11) continue;
    const score = entries.reduce(
      (sum, e) =>
        sum + (e.player ? e.player.overall * e.factor * (0.5 + e.player.fitness / 200) : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      tactics[oldId] = { formation, starters, style: 'balanced' };
    }
  }
  next = { ...next, tactics };
  return next;
}
