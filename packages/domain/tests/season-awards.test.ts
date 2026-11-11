import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/index.js';
import { finalizeSeasonAwards } from '../src/competitions/season-awards.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
import type { WorldState } from '@football/shared';
const world = () =>
  unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Prêmios',
      mode: 'offline',
      now: Date.parse('2026-10-26T15:00:00Z'),
    }),
  );
describe('premiação da temporada', () => {
  it('não inventa candidatos sem participação', () => {
    expect(finalizeSeasonAwards(world()).seasonAwards).toEqual([]);
  });
  it('persiste uma vez e preserva as finanças', () => {
    const state = world();
    const fixture = state.fixtures[0]!;
    const p = state.clubs.byId[fixture.homeId]!.playerIds[0]!;
    const next: WorldState = {
      ...state,
      results: Array.from({ length: 12 }, (_, i) => ({
        status: 'finished',
        fixtureId: fixture.id,
        homeId: fixture.homeId,
        awayId: fixture.awayId,
        homeGoals: 1,
        awayGoals: 0,
        attendance: 0,
        revenue: 0,
        seed: i,
        lineups: { home: [p], away: [] },
        ratings: { [p]: 8 },
        scorers: [{ playerId: p, minute: 20, side: 'home' as const }],
      })),
    };
    const awarded = finalizeSeasonAwards(next);
    expect(awarded.seasonAwards?.length).toBeGreaterThan(0);
    expect(finalizeSeasonAwards(awarded)).toBe(awarded);
    expect(awarded.clubs).toBe(next.clubs);
    expect(awarded.seasonAwards?.find((a) => a.category === 'player-world')?.winners[0]?.id).toBe(
      p,
    );
  });
});
