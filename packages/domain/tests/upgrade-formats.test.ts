import { it, expect } from 'vitest';
import { createWorld } from '../src/game/world-factory.js';
import { groupFixtures } from '../src/competitions/cup-groups.js';
import { upgradeUnstartedCompetitions } from '../src/competitions/upgrade-formats.js';
import { seasonStart } from '../src/competitions/season-calendar.js';
it.each(['libertadores', 'sul-americana', 'copa-nordeste', 'copa-verde', 'copa-sul-sudeste'])(
  'converte %s de A–H para A–D e mantém o treinador',
  (competitionId) => {
    const world = createWorld({
      id: crypto.randomUUID(),
      userId: 'migration',
      name: 'Teste',
      mode: 'offline',
      now: seasonStart(2026),
    });
    if (!world.ok) throw new Error(world.error.message);
    const ids = world.value.clubs.ids.slice(0, 32);
    const old = {
      ...world.value,
      fixtures: groupFixtures(
        ids,
        competitionId,
        Array.from({ length: 6 }, (_, i) => seasonStart(2026) + i * 86400000),
        2,
      ),
      cups: [],
      results: [],
      participants: [{ userId: 'migration', clubId: ids[31]!, ready: false }],
    };
    expect(new Set(old.fixtures.map((f) => f.group)).size).toBe(8);
    const next = upgradeUnstartedCompetitions(old);
    expect([...new Set(next.fixtures.map((f) => f.group))].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(next.fixtures).toHaveLength(48);
    expect(next.fixtures.some((f) => f.homeId === ids[31] || f.awayId === ids[31])).toBe(true);
    expect(upgradeUnstartedCompetitions(next)).toBe(next);
    const first = old.fixtures[0]!;
    const started = {
      ...old,
      results: [
        {
          fixtureId: first.id,
          homeId: first.homeId,
          awayId: first.awayId,
          homeGoals: 1,
          awayGoals: 0,
          attendance: 0,
          revenue: 0,
          seed: 1,
          scorers: [],
          status: 'finished',
        },
      ],
    };
    expect(upgradeUnstartedCompetitions(started)).toBe(started);
  },
);
