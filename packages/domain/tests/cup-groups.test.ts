import { describe, expect, it } from 'vitest';
import {
  createWorld,
  groupFixtures,
  cupGroupTables,
  qualifyCupGroups,
  playNextBatch,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-10-27T15:00:00Z');
function world() {
  return unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Grupos', mode: 'offline', now }),
  );
}

describe('copas com grupos e mata-mata', () => {
  it('cria grupos de quatro com ida e volta sem duplicar confrontos', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `club-${i}`);
    const fixtures = groupFixtures(ids, 'libertadores', [1, 2, 3, 4, 5, 6]);
    expect(fixtures).toHaveLength(24);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(24);
    for (const id of ids) {
      expect(fixtures.filter((f) => f.homeId === id)).toHaveLength(3);
      expect(fixtures.filter((f) => f.awayId === id)).toHaveLength(3);
    }
    for (const group of ['A', 'B'])
      expect(
        new Set(fixtures.filter((f) => f.group === group).flatMap((f) => [f.homeId, f.awayId]))
          .size,
      ).toBe(4);
  });
  it('só monta o mata-mata depois da última partida e cruza primeiros e segundos', () => {
    const base = world();
    const ids = base.clubs.ids.slice(0, 8);
    const fixtures = groupFixtures(ids, 'libertadores', [
      now + 1,
      now + 2,
      now + 3,
      now + 4,
      now + 5,
      now + 6,
    ]);
    const results = fixtures.map((f) => ({
      fixtureId: f.id,
      homeId: f.homeId,
      awayId: f.awayId,
      homeGoals: 1,
      awayGoals: 0,
      attendance: 0,
      revenue: 0,
      seed: 1,
      scorers: [],
      status: 'finished',
    }));
    const partial = { ...base, fixtures, cups: [], results: results.slice(0, -1) };
    expect(qualifyCupGroups(partial).cups).toHaveLength(0);
    const state = { ...partial, results };
    const groups = cupGroupTables(state, 'libertadores');
    const qualified = qualifyCupGroups(state);
    const first = qualified.cups.filter((n) => n.round === 0);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      homeId: groups[0]!.table[0]!.id,
      awayId: groups[1]!.table[1]!.id,
    });
    expect(first[1]).toMatchObject({
      homeId: groups[1]!.table[0]!.id,
      awayId: groups[0]!.table[1]!.id,
    });
    expect(qualifyCupGroups(qualified).cups).toHaveLength(3);
    expect(Math.min(...first.map((n) => n.scheduledAt))).toBeGreaterThan(now + 6);
  });
  it('joga uma copa inteira dos grupos até o campeão', () => {
    const base = world();
    const ids = base.clubs.ids.filter((id) => base.clubs.byId[id]?.division === 'A').slice(0, 8);
    const fixtures = groupFixtures(
      ids,
      'libertadores',
      Array.from({ length: 6 }, (_, i) => now + (i + 1) * 86400000),
    );
    let state = { ...base, fixtures, cups: [], results: [] } as typeof base;
    for (let i = 0; i < 12 && state.status !== 'finished'; i++)
      state = unwrap(playNextBatch(state, now + i * 100000));
    expect(state.status).toBe('finished');
    expect(state.results).toHaveLength(29);
    expect(state.cups.every((n) => n.winnerId)).toBe(true);
    expect(state.trophies.some((t) => t.competitionId === 'libertadores')).toBe(true);
  });
});
