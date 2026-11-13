import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Fixture, type WorldState } from '@football/shared';
import { createWorld } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
const base = unwrap(
  createWorld({ id: IDS.league, name: 'Copas legadas', mode: 'offline', userId: IDS.user, now }),
);
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.doUnmock('@football/shared');
  vi.resetModules();
});

describe('leitura dos regulamentos antigos sem alterar o regulamento atual', () => {
  it.each(['paired', 'external'] as const)(
    'reconstrói confrontos legados entre grupos no modo %s',
    async (groupMode) => {
      vi.doMock('@football/shared', async () => {
        const actual = await vi.importActual<typeof import('@football/shared')>('@football/shared');
        return {
          ...actual,
          COMPETITIONS: actual.COMPETITIONS.map((rule) =>
            rule.id === 'copa-verde' ? { ...rule, groupSize: 6, groupMode } : rule,
          ),
        };
      });
      const { groupFixtures, cupGroupTables } = await import('../src/competitions/cup-groups.js');
      const ids = base.clubs.ids.slice(0, 24);
      const fixtures = groupFixtures(
        ids,
        'copa-verde',
        Array.from({ length: 24 }, (_, i) => now + i * 86400000),
      );
      expect(fixtures.length).toBe(groupMode === 'paired' ? 72 : 216);
      expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
      expect(fixtures.every((f) => f.homeId !== f.awayId && f.group !== f.awayGroup)).toBe(true);
      expect(cupGroupTables({ fixtures, results: [] }, 'copa-verde')).toHaveLength(4);
      expect(groupFixtures(ids.slice(0, 5), 'copa-verde', [])).toEqual([]);
    },
  );
  it.each([
    ['mineiro', 'copa-nordeste', 12],
    ['sul-sudeste', 'copa-sul-sudeste', 16],
    ['nordeste', 'copa-nordeste', 16],
    ['carioca', 'copa-verde', 8],
    ['sudamericana', 'sul-americana', 16],
  ] as const)(
    'conclui os grupos persistidos no formato %s',
    async (advancement, competitionId, count) => {
      vi.doMock('@football/shared', async () => {
        const actual = await vi.importActual<typeof import('@football/shared')>('@football/shared');
        return {
          ...actual,
          COMPETITIONS: actual.COMPETITIONS.map((rule) =>
            rule.id === competitionId ? { ...rule, groupSize: 4, advancement } : rule,
          ),
        };
      });
      const { groupFixtures, qualifyCupGroups } = await import('../src/competitions/cup-groups.js');
      const ids = base.clubs.ids.slice(0, count);
      const fixtures: Fixture[] = groupFixtures(
        ids,
        competitionId,
        Array.from({ length: 6 }, (_, i) => now + i * 86400000),
      );
      if (advancement === 'sudamericana')
        fixtures.push(
          ...groupFixtures(
            base.clubs.ids.slice(count, count * 2),
            'libertadores',
            Array.from({ length: 6 }, (_, i) => now + i * 86400000),
          ),
        );
      const results = fixtures.map((f, i) => ({
        fixtureId: f.id,
        homeId: f.homeId,
        awayId: f.awayId,
        homeGoals: i % 3,
        awayGoals: (i + 1) % 3,
        attendance: 0,
        revenue: 0,
        seed: 1,
        scorers: [],
        status: 'finished',
      }));
      const state: WorldState = { ...base, fixtures, results, cups: [] };
      const next = qualifyCupGroups(state);
      const nodes = next.cups.filter((c) => c.competitionId === competitionId);
      expect(nodes.length).toBeGreaterThan(0);
      expect(new Set(nodes.map((c) => c.id)).size).toBe(nodes.length);
      expect(nodes.every((c) => !c.homeId || c.homeId !== c.awayId)).toBe(true);
      expect(qualifyCupGroups(next).cups).toEqual(next.cups);
      if (advancement === 'sudamericana') {
        expect(nodes.filter((c) => c.id.includes('playoff'))).toHaveLength(4);
        const incomplete = {
          ...state,
          results: state.results.filter((r) => r.fixtureId !== fixtures.at(-1)!.id),
        };
        expect(
          qualifyCupGroups(incomplete).cups.filter((c) => c.competitionId === competitionId),
        ).toHaveLength(0);
      }
    },
  );
});
