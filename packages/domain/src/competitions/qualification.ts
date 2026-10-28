import type { WorldState } from '@football/shared';
import { standings } from './standings.js';
export type ContinentalPlace = {
  clubId: string;
  competition: 'libertadores' | 'pre-libertadores' | 'sul-americana';
  origin: 'league' | 'title' | 'inherited';
  source: string;
};
export function cupFinal(state: WorldState, competitionId: string) {
  return state.cups.find(
    (node) =>
      node.competitionId === competitionId &&
      !state.cups.some((parent) => parent.leftId === node.id || parent.rightId === node.id),
  );
}
export function continentalPlaces(state: WorldState): ContinentalPlace[] {
  const table = standings(
    state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'A'),
    state.fixtures.filter((f) => f.competitionId === 'serie-a'),
    state.results,
  );
  const eligible = table.slice(0, 16).map((row) => row.id);
  const places: ContinentalPlace[] = [];
  const assigned = new Set<string>();
  const league = (
    competition: ContinentalPlace['competition'],
    source: string,
    origin: ContinentalPlace['origin'] = 'league',
  ) => {
    const id = eligible.find((id) => !assigned.has(id));
    if (id) {
      assigned.add(id);
      places.push({ clubId: id, competition, origin, source });
    }
  };
  const title = (
    id: string | undefined,
    competition: ContinentalPlace['competition'],
    source: string,
  ) => {
    if (!id || state.clubs.byId[id]?.country !== 'BR') return;
    if (assigned.has(id)) {
      const current = places.find((place) => place.clubId === id);
      if (current?.competition === 'libertadores' && competition === 'libertadores') {
        current.origin = 'title';
        current.source = source;
      }
      league(competition, source, 'inherited');
      return;
    }
    assigned.add(id);
    places.push({ clubId: id, competition, origin: 'title', source });
  };
  for (let i = 0; i < 4; i++) league('libertadores', 'Série A');
  for (const id of ['copa-brasil', 'libertadores', 'sul-americana'])
    title(cupFinal(state, id)?.winnerId ?? undefined, 'libertadores', id);
  for (let i = 0; i < 2; i++) league('pre-libertadores', 'Série A');
  const final = cupFinal(state, 'copa-brasil');
  if (final?.winnerId)
    title(
      final.homeId === final.winnerId ? (final.awayId ?? undefined) : (final.homeId ?? undefined),
      'pre-libertadores',
      'Vice da Copa do Brasil',
    );
  for (let i = 0; i < 5; i++) league('sul-americana', 'Série A');
  return places;
}
export function regionalPromotions(state: WorldState): string[] {
  const promoted: string[] = [];
  const ids = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'D');
  for (const competitionId of ['copa-nordeste', 'copa-sul-sudeste', 'copa-verde']) {
    const nodes = state.cups.filter((node) => node.competitionId === competitionId);
    const fixtures = state.fixtures.filter((f) => f.competitionId === competitionId);
    const participants = new Set([
      ...fixtures.flatMap((f) => [f.homeId, f.awayId]),
      ...nodes.flatMap((n) => [n.homeId, n.awayId].filter((id): id is string => !!id)),
    ]);
    const candidates = standings(
      ids.filter((id) => participants.has(id)),
      fixtures,
      state.results,
    ).map((row) => row.id);
    const reached = (id: string) =>
      Math.max(
        -1,
        ...nodes
          .filter((n) => n.homeId === id || n.awayId === id)
          .map((n) => n.round + (n.winnerId === id ? 0.5 : 0)),
      );
    candidates.sort((a, b) => reached(b) - reached(a));
    const best = candidates[0];
    if (best && !promoted.includes(best)) promoted.push(best);
  }
  const table = standings(
    ids,
    state.fixtures.filter((f) => f.competitionId === 'serie-d'),
    state.results,
  );
  for (const row of table)
    if (promoted.length < 4 && !promoted.includes(row.id)) promoted.push(row.id);
  return promoted.slice(0, 4);
}
