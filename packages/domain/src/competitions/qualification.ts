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
/** Kept for existing callers; access is determined only by the Serie D table. */
export function regionalPromotions(state: WorldState): string[] {
  const ids = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'D');
  return standings(
    ids,
    state.fixtures.filter((f) => f.competitionId === 'serie-d'),
    state.results,
  )
    .slice(0, 4)
    .map((row) => row.id);
}
