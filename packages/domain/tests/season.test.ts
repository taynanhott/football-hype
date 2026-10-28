import { describe, expect, it } from 'vitest';
import {
  createWorld,
  playNextBatch,
  executeCommand,
  applyEvent,
  stableId,
  pendingFixtures,
  regionalPromotions,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const NOW = Date.parse('2026-10-26T15:00:00Z');
describe('ciclo completo da temporada', () => {
  it('disputa todas as rodadas e copas, depois aplica acessos e descensos e envelhece atletas', () => {
    let state = unwrap(
      createWorld({
        id: IDS.league,
        userId: IDS.user,
        name: 'Temporada',
        mode: 'offline',
        now: NOW,
      }),
    );
    const previousClubs = state.clubs.byId;
    const originalPlayer = state.players.byId[state.players.ids[0] ?? ''];
    for (let index = 0; index < 366 && state.status === 'active'; index++)
      state = unwrap(playNextBatch(state, NOW));
    expect(state.status).toBe('finished');
    expect(pendingFixtures(state)).toHaveLength(0);
    expect(state.cups.every((node) => node.winnerId !== null)).toBe(true);
    expect(playNextBatch(state, NOW).ok).toBe(false);
    const expectedDPromotions = regionalPromotions(state);
    const event = unwrap(
      executeCommand(state, { type: 'new-season' }, IDS.user, NOW, stableId(9, 999)),
    );
    const next = unwrap(applyEvent(state, event));
    expect(next.season).toBe(state.season + 1);
    expect(new Date(next.lastProcessedAt).toISOString()).toBe(`${next.season}-01-11T11:00:00.000Z`);
    expect(next.results).toEqual([]);
    expect(next.seasonArchives).toEqual([
      {
        season: state.season,
        clubs: state.clubs,
        fixtures: state.fixtures,
        results: state.results.map((result) => ({
          ...result,
          actions: (result.actions ?? [])
            .filter((action) => action.type === 'yellow' || action.type === 'red')
            .map((action) => ({
              minute: action.minute,
              type: action.type,
              side: action.side,
              x: action.x,
              z: action.z,
            })),
        })),
        cups: state.cups,
        ...(state.competitionNotes ? { competitionNotes: state.competitionNotes } : {}),
      },
    ]);
    expect(state.trophies.length).toBeGreaterThan(0);
    expect(next.trophies).toEqual(state.trophies);
    expect(next.ratingHistory).toEqual(state.ratingHistory);
    expect(next.status).toBe('active');
    expect(expectedDPromotions.every((id) => next.clubs.byId[id]?.division === 'C')).toBe(true);
    expect(next.players.byId[state.players.ids[0] ?? '']?.age).toBe((originalPlayer?.age ?? 0) + 1);
    expect(next.clubs.ids.filter((id) => next.clubs.byId[id]?.division === 'A')).toHaveLength(20);
    expect(next.clubs.ids.filter((id) => next.clubs.byId[id]?.division === 'B')).toHaveLength(20);
    expect(next.clubs.ids.filter((id) => next.clubs.byId[id]?.division === 'C')).toHaveLength(20);
    expect(next.clubs.ids.filter((id) => next.clubs.byId[id]?.division === 'D')).toHaveLength(25);
    expect(
      next.clubs.ids.filter(
        (id) => previousClubs[id]?.division === 'D' && next.clubs.byId[id]?.division === 'C',
      ),
    ).toHaveLength(4);
    expect(next.fixtures.every((fixture) => fixture.scheduledAt > state.lastProcessedAt)).toBe(
      true,
    );
  }, 60000);
});
