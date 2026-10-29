import { expect, it } from 'vitest';
import { createWorld, normalizeRoundCalendar } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
import { readFileSync } from 'node:fs';
import {
  cupCalendarNodes,
  cupRoundKey,
  competitionDates,
  importDataset,
  scheduledFixtures,
  scheduledBatches,
  realFixtureTime,
  ROUND_CALENDAR_VERSION,
} from '../src/index.js';
import { clubCalendarPendingGames } from '../../../apps/client/src/features/competitions/club-calendar-fixtures.js';
const dataset = JSON.parse(
  readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
);
function importedWorld() {
  return normalizeRoundCalendar(
    unwrap(
      importDataset(
        unwrap(
          createWorld({
            id: IDS.league,
            userId: IDS.user,
            name: 'Audit',
            mode: 'multiplayer',
            now: Date.UTC(2026, 0, 11, 12),
          }),
        ),
        dataset,
      ),
    ),
  );
}

it('keeps a new 2026 season within its year and normalization stable', () => {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Calendário',
      mode: 'multiplayer',
      now: Date.UTC(2026, 0, 11, 12),
    }),
  );
  const calendar = normalizeRoundCalendar(state);
  expect(Math.max(...Object.values(calendar.roundDates ?? {}))).toBeLessThan(
    Date.UTC(2027, 0, 1, 3),
  );
  expect(normalizeRoundCalendar(calendar)).toBe(calendar);
});

it('reserves the group cups through their finals and keeps all rounds within 2026', () => {
  const state = importedWorld();
  expect(Math.max(...Object.values(state.roundDates!))).toBeLessThan(Date.UTC(2027, 0, 1, 3));
  for (const id of [
    'libertadores',
    'sul-americana',
    'copa-nordeste',
    'copa-sul-sudeste',
    'copa-verde',
  ]) {
    const nodes = cupCalendarNodes(state).filter((n) => n.competitionId === id);
    expect(nodes).toHaveLength(3);
    expect(nodes.at(-1)?.label).toBe('Final');
    expect(state.roundDates![cupRoundKey(id, 2, 0)]).toBeDefined();
    const club = state.fixtures.find((f) => f.competitionId === id)!.homeId;
    expect(
      clubCalendarPendingGames(state, club).some(
        (game) => game.competitionId === id && game.label.startsWith('Final'),
      ),
    ).toBe(true);
  }
});

it('plays Serie A in June and distributes reference rounds over more than Sundays', () => {
  const dates = competitionDates('serie-a', 2026, 38);
  expect(dates.some((at) => new Date(at).getUTCMonth() === 5)).toBe(true);
  expect(new Set(dates.map((at) => new Date(at).getUTCDay())).size).toBeGreaterThan(1);
  const state = importedWorld();
  expect(
    state.fixtures.some(
      (f) => f.competitionId === 'serie-a' && new Date(f.scheduledAt).getUTCMonth() === 5,
    ),
  ).toBe(true);
});

it('does not schedule the same club twice on one game date', () => {
  const state = importedWorld();
  const seen = new Set<string>();
  for (const f of scheduledFixtures(state)) {
    for (const club of [f.homeId, f.awayId]) {
      const key = `${club}:${new Date(f.scheduledAt).toISOString().slice(0, 10)}`;
      expect(seen.has(key), `${f.competitionId} ${key}`).toBe(false);
      seen.add(key);
    }
  }
});

it('allows disjoint divisions on the same date and real slot, while blocking a shared club', () => {
  const state = importedWorld();
  const date = Date.UTC(2026, 4, 10, 19);
  const [a, b, c, d] = state.clubs.ids;
  const base = {
    ...state,
    cups: [],
    competitionDraws: [],
    roundDates: {},
    roundCalendarVersion: ROUND_CALENDAR_VERSION,
    fixtures: [
      { id: 'a', competitionId: 'serie-a', round: 0, homeId: a!, awayId: b!, scheduledAt: date },
      { id: 'b', competitionId: 'serie-b', round: 0, homeId: c!, awayId: d!, scheduledAt: date },
      {
        id: 'cup',
        competitionId: 'copa-brasil',
        round: 0,
        homeId: a!,
        awayId: c!,
        scheduledAt: date,
      },
    ],
  };
  const calendar = normalizeRoundCalendar(base);
  const [first, second, cup] = calendar.fixtures;
  expect(first!.scheduledAt).toBe(second!.scheduledAt);
  expect(cup!.scheduledAt).not.toBe(first!.scheduledAt);
  const batches = scheduledBatches(calendar.fixtures);
  expect(batches.find((batch) => batch.some((f) => f.id === 'a'))).toHaveLength(2);
  const clock = { ...calendar, seasonClock: 1 as const };
  expect(realFixtureTime(clock, calendar.fixtures, first!)).toBe(
    realFixtureTime(clock, calendar.fixtures, second!),
  );
});

it('migrates a previous calendar once and preserves elapsed fixture dates', () => {
  const state = importedWorld();
  const first = [...state.fixtures].sort((a, b) => a.scheduledAt - b.scheduledAt)[0]!;
  const migrated = normalizeRoundCalendar({
    ...state,
    lastProcessedAt: first.scheduledAt,
    roundCalendarVersion: 3,
  });
  expect(migrated.fixtures.find((f) => f.id === first.id)?.scheduledAt).toBe(first.scheduledAt);
  expect(migrated.roundCalendarVersion).toBe(ROUND_CALENDAR_VERSION);
  expect(normalizeRoundCalendar(migrated)).toBe(migrated);
});
