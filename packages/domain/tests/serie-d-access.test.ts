import { expect, it } from 'vitest';
import { COMPETITIONS } from '@football/shared';
import { createWorld, standings, regionalPromotions, qualificationPlaces } from '../src/index.js';
it('promove apenas os quatro primeiros da liga, sem rebaixamento nem acesso por copas', () => {
  const result = createWorld({
    id: crypto.randomUUID(),
    userId: 'd-access',
    name: 'Série D',
    mode: 'offline',
    now: Date.UTC(2026, 0, 11, 12),
  });
  if (!result.ok) throw Error(result.error.message);
  const state = result.value;
  const ids = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'D');
  const table = standings(
    ids,
    state.fixtures.filter((f) => f.competitionId === 'serie-d'),
    [],
  );
  const last = table.at(-1)!.id;
  state.cups = [
    {
      id: 'copa-verde:final',
      competitionId: 'copa-verde',
      round: 2,
      homeId: last,
      awayId: table[10]!.id,
      leftId: null,
      rightId: null,
      winnerId: last,
      scheduledAt: Date.UTC(2026, 5, 1),
    },
  ];
  expect(regionalPromotions(state)).toEqual(table.slice(0, 4).map((row) => row.id));
  expect(regionalPromotions(state)).not.toContain(last);
  const rule = COMPETITIONS.find((r) => r.id === 'serie-d')!;
  expect(qualificationPlaces(table, rule).relegated).toEqual([]);
  const games = state.fixtures.filter((f) => f.competitionId === 'serie-d');
  for (const id of ids)
    expect(games.filter((f) => f.homeId === id || f.awayId === id)).toHaveLength(
      (ids.length - 1) * 2,
    );
});
