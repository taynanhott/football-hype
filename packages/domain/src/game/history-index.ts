import type { WorldState } from '@football/shared';

type Result = WorldState['results'][number];
type Rating = WorldState['ratingHistory'][number];
const resultsCache = new WeakMap<
  WorldState['results'],
  { length: number; clubs: Map<string, Result[]> }
>();
const ratingsCache = new WeakMap<
  WorldState['ratingHistory'],
  { length: number; players: Map<string, Rating[]> }
>();

/** Index immutable history once for all players using the same revision. */
export function clubResults(state: WorldState, clubId: string) {
  let index = resultsCache.get(state.results);
  if (!index || index.length !== state.results.length) {
    const clubs = new Map<string, Result[]>();
    for (const result of state.results) {
      for (const id of new Set([result.homeId, result.awayId])) {
        if (!id) continue;
        const games = clubs.get(id) ?? [];
        games.push(result);
        clubs.set(id, games);
      }
    }
    index = { length: state.results.length, clubs };
    resultsCache.set(state.results, index);
  }
  return index.clubs.get(clubId) ?? [];
}

export function playerRatings(state: WorldState, playerId: string) {
  let index = ratingsCache.get(state.ratingHistory);
  if (!index || index.length !== state.ratingHistory.length) {
    const players = new Map<string, Rating[]>();
    for (const rating of state.ratingHistory) {
      const history = players.get(rating.playerId) ?? [];
      history.push(rating);
      players.set(rating.playerId, history);
    }
    index = { length: state.ratingHistory.length, players };
    ratingsCache.set(state.ratingHistory, index);
  }
  return index.players.get(playerId) ?? [];
}
