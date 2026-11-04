import { describe, expect, it } from 'vitest';
import type { WorldState } from '@football/shared';
import { playerCardStats } from '../src/features/players/player-card-stats';

const match = (overrides: Record<string, unknown> = {}) => ({
  lineups: { home: ['starter'], away: ['opponent'] },
  substitutions: [{ in: 'sub', out: 'starter', minute: 65 }],
  minutesPlayed: { starter: 65, sub: 25, opponent: 90 },
  ratings: { starter: 7, sub: 8, opponent: 6 },
  scorers: [{ playerId: 'sub', assistId: 'starter' }],
  actions: [{ type: 'yellow', playerId: 'sub' }],
  ...overrides,
});
const world = (results = [match()], notes = [7, 8, 5, 9, 6, 10]) =>
  ({
    season: 2026,
    results,
    ratingHistory: [
      { playerId: 'sub', season: 2025, rating: 1 },
      ...notes.map((rating) => ({ playerId: 'sub', season: 2026, rating })),
    ],
  }) as unknown as WorldState;

describe('statistics on the player card', () => {
  it('includes substitute appearances, goals, assists, minutes and yellow cards', () => {
    const state = world(undefined, [8]);
    expect(playerCardStats(state, 'sub')).toMatchObject({
      games: 1,
      goals: 1,
      assists: 0,
      minutes: 25,
      yellow: 1,
    });
    expect(playerCardStats(state, 'starter')).toMatchObject({
      games: 1,
      goals: 0,
      assists: 1,
      minutes: 65,
    });
    expect(playerCardStats(state, 'unused')).toMatchObject({
      games: 0,
      minutes: 0,
      goals: 0,
      average: null,
    });
  });
  it('uses current-season ratings and the last five for form', () => {
    expect(playerCardStats(world(), 'sub')).toMatchObject({ average: 7.5, form: 7.6 });
  });
  it('handles old matches without recorded minutes and refreshes with a new snapshot', () => {
    const first = world([match({ minutesPlayed: undefined })], [8]);
    expect(playerCardStats(first, 'sub').minutes).toBe(25);
    expect(playerCardStats(first, 'starter').minutes).toBe(65);
    const next = world([match(), match()], [8, 9]);
    expect(playerCardStats(next, 'sub')).toMatchObject({
      games: 2,
      goals: 2,
      minutes: 50,
      average: 8.5,
    });
  });
});
