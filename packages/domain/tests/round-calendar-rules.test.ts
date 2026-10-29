import { describe, it, expect } from 'vitest';
import { COMPETITIONS, knockoutLegs } from '@football/shared';
import { createWorld, seasonSchedule } from '../src/game/world-factory.js';
import { scheduledFixtures } from '../src/competitions/fixtures.js';
import { normalizeRoundCalendar, fixtureRoundKey } from '../src/competitions/round-calendar.js';
import { seasonStart } from '../src/competitions/season-calendar.js';
import { groupFixtures } from '../src/competitions/cup-groups.js';
const DAY = 86400000;
describe('regras compactas de torneio e datas exclusivas', () => {
  it('gera quatro grupos A–D, seis jogos por clube e mata-matas únicos', () => {
    for (const id of ['libertadores', 'copa-nordeste', 'copa-verde', 'copa-sul-sudeste']) {
      const rule = COMPETITIONS.find((r) => r.id === id)!;
      expect(rule.teamCount).toBe(16);
      expect(rule.groupCount).toBe(4);
      const ids = Array.from({ length: 16 }, (_, i) => `club-${i}`);
      const fixtures = groupFixtures(
        ids,
        id,
        Array.from({ length: 6 }, (_, i) => seasonStart(2026) + i * 7 * DAY),
        rule.groupLegs,
      );
      expect([...new Set(fixtures.map((f) => f.group))].sort()).toEqual(['A', 'B', 'C', 'D']);
      for (const club of ids)
        expect(fixtures.filter((f) => f.homeId === club || f.awayId === club)).toHaveLength(6);
      for (let round = 0; round < 6; round++)
        expect(fixtures.filter((f) => f.round === round)).toHaveLength(8);
      for (let round = 0; round < 3; round++) expect(knockoutLegs(id, round, 2)).toBe(1);
    }
    expect(knockoutLegs('pre-libertadores', 0, 0)).toBe(2);
    for (let round = 0; round < 5; round++) expect(knockoutLegs('copa-brasil', round, 4)).toBe(1);
    expect(knockoutLegs('intercontinental', 0, 0)).toBe(1);
  });
  it('permite torneios paralelos sem repetir um clube no mesmo dia e mantém rodadas juntas', () => {
    const result = createWorld({
      id: crypto.randomUUID(),
      userId: 'calendar-test',
      name: 'Calendário',
      mode: 'offline',
      now: seasonStart(2026),
    });
    if (!result.ok) throw new Error(result.error.message);
    const state = normalizeRoundCalendar(result.value);
    const all = scheduledFixtures(state);
    const days = new Map<number, Set<string>>();
    const teams = new Set<string>();
    const rounds = new Map<string, Set<number>>();
    for (const fixture of all) {
      const date = Math.floor((fixture.scheduledAt - 10800000) / DAY);
      const entries = days.get(date) ?? new Set<string>();
      entries.add(fixture.competitionId);
      days.set(date, entries);
      for (const club of [fixture.homeId, fixture.awayId]) {
        const key = `${date}:${club}`;
        expect(teams.has(key)).toBe(false);
        teams.add(key);
      }
      if (state.fixtures.some((f) => f.id === fixture.id)) {
        const key = fixtureRoundKey(fixture);
        const dates = rounds.get(key) ?? new Set<number>();
        dates.add(date);
        rounds.set(key, dates);
      }
    }
    expect([...days.values()].some((entries) => entries.size > 1)).toBe(true);
    const byCompetition = new Map<string, number[]>();
    for (const [key, dates] of rounds) {
      const competition = key.split(':')[0]!;
      const entries = byCompetition.get(competition) ?? [];
      entries.push(...dates);
      byCompetition.set(competition, entries);
    }
    for (const entries of byCompetition.values()) {
      entries.sort((a, b) => a - b);
      for (let i = 1; i < entries.length; i++)
        expect(entries[i]! - entries[i - 1]!).toBeGreaterThanOrEqual(3);
    }
    for (const dates of rounds.values()) expect(dates.size).toBe(1);
    expect(normalizeRoundCalendar(state)).toBe(state);
    const schedule = seasonSchedule(Object.values(state.clubs.byId), seasonStart(2026));
    for (const fixture of schedule.fixtures.filter((f) =>
      ['copa-nordeste', 'copa-verde', 'copa-sul-sudeste'].includes(f.competitionId),
    )) {
      expect(state.clubs.byId[fixture.homeId]?.division).not.toBe('A');
      expect(state.clubs.byId[fixture.awayId]?.division).not.toBe('A');
    }
  });
});
