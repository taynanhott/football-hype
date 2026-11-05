import { it, expect } from 'vitest';
import { createWorld, playNextBatch, stableId } from '../src/index.js';
import { clubResults, playerRatings } from '../src/game/history-index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

it('keeps each club and player history in order when a new round is recorded', () => {
  const initial = unwrap(
    createWorld({
      id: stableId(997, 3),
      userId: 'host',
      name: 'History',
      mode: 'offline',
      now: Date.UTC(2026, 0, 15),
    }),
  );
  const first = unwrap(playNextBatch(initial, Date.UTC(2026, 0, 16)));
  const second = unwrap(playNextBatch(first, Date.UTC(2026, 0, 17)));
  for (const state of [initial, first, second, first]) {
    for (const id of state.clubs.ids) {
      expect(clubResults(state, id)).toEqual(
        state.results.filter((result) => result.homeId === id || result.awayId === id),
      );
    }
    for (const id of Object.keys(second.results[0]?.ratings ?? {})) {
      expect(playerRatings(state, id)).toEqual(
        state.ratingHistory.filter((rating) => rating.playerId === id),
      );
    }
  }
});
