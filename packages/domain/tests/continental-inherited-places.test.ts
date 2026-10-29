import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createWorld,
  importDataset,
  continentalPlaces,
  standings,
  seasonSchedule,
  realizeCompetitionDraws,
  normalizeRoundCalendar,
  seasonStart,
} from '../src/index.js';
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw Error(r.error.message);
  return r.value;
};
function world() {
  return unwrap(
    importDataset(
      unwrap(
        createWorld({
          id: crypto.randomUUID(),
          userId: 'titles',
          name: 'Títulos',
          mode: 'offline',
          now: Date.UTC(2026, 0, 11, 12),
        }),
      ),
      JSON.parse(
        readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
      ),
    ),
  );
}
it('repassa os três títulos ao próximo do Brasileirão sem duplicar o campeão', () => {
  const state = world();
  const table = standings(
    state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'A'),
    state.fixtures.filter((f) => f.competitionId === 'serie-a'),
    [],
  );
  const champion = table[0]!.id;
  state.cups = ['copa-brasil', 'libertadores', 'sul-americana'].map((competitionId) => ({
    id: `${competitionId}:final`,
    competitionId,
    round: 4,
    homeId: champion,
    awayId: table[10]!.id,
    leftId: null,
    rightId: null,
    winnerId: champion,
    scheduledAt: Date.UTC(2026, 11, 1),
  }));
  const places = continentalPlaces(state);
  const lib = places.filter((p) => p.competition === 'libertadores');
  expect(lib).toHaveLength(7);
  expect(lib.filter((p) => p.clubId === champion)).toHaveLength(1);
  expect(lib.map((p) => p.clubId).sort()).toEqual(
    table
      .slice(0, 7)
      .map((r) => r.id)
      .sort(),
  );
  expect(new Set(places.map((p) => p.clubId)).size).toBe(places.length);
});
it('mantém 16 clubes na Sula e na Libertadores após a pré mesmo com vagas herdadas', () => {
  const state = world();
  const a = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'A');
  const schedule = seasonSchedule(Object.values(state.clubs.byId), seasonStart(2027), {
    libertadores: a.slice(0, 7),
    preLibertadores: a.slice(7, 10),
    sulAmericana: a.slice(10, 15),
  });
  const next = normalizeRoundCalendar({
    ...state,
    ...schedule,
    season: 2027,
    lastProcessedAt: seasonStart(2027),
    roundDates: {},
    roundCalendarVersion: 0,
    cups: schedule.cups.map((n) =>
      n.competitionId === 'pre-libertadores' ? { ...n, winnerId: n.homeId } : n,
    ),
  });
  const drawn = realizeCompetitionDraws(next, Date.UTC(2027, 5, 1));
  for (const id of ['libertadores', 'sul-americana']) {
    const draw = drawn.competitionDraws!.find((d) => d.competitionId === id)!;
    expect(draw.completedAt).toBeDefined();
    expect(draw.participantIds).toHaveLength(16);
    expect(
      new Set(
        drawn.fixtures.filter((f) => f.competitionId === id).flatMap((f) => [f.homeId, f.awayId]),
      ).size,
    ).toBe(16);
  }
  const lib = drawn.competitionDraws!.find(
    (d) => d.competitionId === 'libertadores',
  )!.participantIds;
  const sul = drawn.competitionDraws!.find(
    (d) => d.competitionId === 'sul-americana',
  )!.participantIds;
  expect(lib.some((id) => sul.includes(id))).toBe(false);
});
