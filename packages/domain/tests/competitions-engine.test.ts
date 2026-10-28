import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COMPETITIONS, type Fixture, type MatchResult } from '@football/shared';
import {
  advanceBracket,
  brazilMinute,
  buildBracket,
  calendarDates,
  dueFixtures,
  isFifaWindow,
  isPlayingWindow,
  nextPlayingTime,
  PriorityQueue,
  qualificationPlaces,
  roundRobin,
  standings,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const START = Date.parse('2026-10-26T15:00:00Z');
describe('calendário e competições', () => {
  it('cada par se encontra em casa e fora, sem dois jogos do clube na rodada', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 24 }), (size) => {
        const ids = Array.from({ length: size }, (_, index) => String(index));
        const matches = unwrap(roundRobin(ids));
        expect(matches.length).toBe(size * (size - 1));
        for (const id of ids) {
          expect(matches.filter((match) => match.homeId === id)).toHaveLength(size - 1);
          expect(matches.filter((match) => match.awayId === id)).toHaveLength(size - 1);
        }
        expect(new Set(matches.map((match) => `${match.homeId}:${match.awayId}`)).size).toBe(
          matches.length,
        );
        for (const round of new Set(matches.map((match) => match.round))) {
          const clubs = matches
            .filter((match) => match.round === round)
            .flatMap((match) => [match.homeId, match.awayId]);
          expect(new Set(clubs).size).toBe(clubs.length);
        }
      }),
    );
    expect(roundRobin(['a', 'a']).ok).toBe(false);
    expect(roundRobin([]).ok).toBe(false);
    expect(unwrap(roundRobin(['a', 'b'], 1))).toHaveLength(1);
  });
  it('equilibra os mandos por turno e limita sequências em casa ou fora', () => {
    for (let size = 2; size <= 24; size++) {
      const ids = Array.from({ length: size }, (_, index) => String(index));
      const rounds = size % 2 === 0 ? size - 1 : size;
      const firstLeg = unwrap(roundRobin(ids, 1));
      const matches = unwrap(roundRobin(ids));
      for (const id of ids) {
        const home = firstLeg.filter((match) => match.homeId === id).length;
        const away = firstLeg.filter((match) => match.awayId === id).length;
        expect(Math.abs(home - away)).toBeLessThanOrEqual(1);
        const venues = matches
          .filter((match) => match.homeId === id || match.awayId === id)
          .map((match) => (match.homeId === id ? 'H' : 'A'))
          .join('');
        // Four-team mirrored schedules can require three consecutive venues.
        expect(venues).not.toMatch(size === 4 ? /H{4}|A{4}/ : /H{3}|A{3}/);
      }
      for (const match of firstLeg) {
        expect(matches).toContainEqual({
          round: match.round + rounds,
          homeId: match.awayId,
          awayId: match.homeId,
        });
      }
    }
  });
  it('heap remove sempre o menor elemento', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (values) => {
        const heap = new PriorityQueue<number>((a, b) => a - b);
        expect(heap.pop()).toBeUndefined();
        values.forEach((value) => heap.push(value));
        expect(heap.size).toBe(values.length);
        expect(Array.from({ length: values.length }, () => heap.pop())).toEqual(
          [...values].sort((a, b) => a - b),
        );
        expect(heap.peek()).toBeUndefined();
      }),
    );
  });
  it('a árvore promove apenas vencedores válidos e não altera o chaveamento anterior', () => {
    const tree = unwrap(buildBracket(['a', 'b', 'c', 'd'], 'cup', [1, 2]));
    expect(tree).toHaveLength(3);
    const next = unwrap(advanceBracket(tree, 'cup:0:0', 'a'));
    expect(next.find((node) => node.id === 'cup:1:0')?.homeId).toBe('a');
    expect(tree.find((node) => node.id === 'cup:1:0')?.homeId).toBeNull();
    expect(advanceBracket(next, 'cup:0:0', 'a').ok).toBe(false);
    expect(advanceBracket(tree, 'cup:0:0', 'x').ok).toBe(false);
    expect(advanceBracket(tree, 'missing', 'a').ok).toBe(false);
    expect(buildBracket(['a', 'b', 'c'], 'cup', [1, 2]).ok).toBe(false);
    expect(buildBracket(['a', 'a'], 'cup', [1]).ok).toBe(false);
    expect(buildBracket(['a', 'b'], 'cup', []).ok).toBe(false);
  });
  it('respeita 08h a 23h30 de Brasília e pára nas datas FIFA', () => {
    expect(isPlayingWindow(Date.parse('2026-10-26T10:59:00Z'))).toBe(false);
    expect(isPlayingWindow(Date.parse('2026-10-26T11:00:00Z'))).toBe(true);
    expect(isPlayingWindow(Date.parse('2026-10-27T02:30:00Z'))).toBe(true);
    expect(isPlayingWindow(Date.parse('2026-10-27T02:31:00Z'))).toBe(false);
    expect(nextPlayingTime(START)).toBe(START);
    expect(brazilMinute(nextPlayingTime(Date.parse('2026-10-27T03:00:00Z')))).toBe(480);
    expect(brazilMinute(nextPlayingTime(Date.parse('2026-10-27T02:31:00Z')))).toBe(480);
    expect(isFifaWindow(Date.parse('2026-11-12T16:00:00Z'))).toBe(true);
    for (const cup of [true, false]) {
      const dates = calendarDates(START, 40, cup);
      expect(dates).toHaveLength(40);
      expect(new Set(dates).size).toBe(40);
      expect(
        dates.every((date) => date > START && isPlayingWindow(date) && !isFifaWindow(date)),
      ).toBe(true);
    }
    const fixture: Fixture = {
      id: 'one',
      competitionId: 'a',
      round: 0,
      homeId: IDS.club,
      awayId: IDS.secondClub,
      scheduledAt: START,
    };
    expect(dueFixtures([fixture], START)).toEqual([fixture]);
    expect(dueFixtures([fixture], START - 1)).toEqual([]);
  });
  it('aplica desempates e distribui vagas sem sobreposição continental', () => {
    const fixture: Fixture = {
      id: 'one',
      competitionId: 'serie-a',
      round: 0,
      homeId: IDS.club,
      awayId: IDS.secondClub,
      scheduledAt: START,
    };
    const result: MatchResult = {
      status: 'finished',
      fixtureId: 'one',
      homeGoals: 2,
      awayGoals: 1,
      attendance: 100,
      revenue: 100,
      seed: 1,
      scorers: [],
    };
    const table = standings(
      [IDS.club, IDS.secondClub],
      [fixture],
      [result, { ...result, fixtureId: 'ignored' }],
    );
    expect(table[0]).toMatchObject({ id: IDS.club, points: 3, wins: 1, goalDifference: 1 });
    expect(table[1]).toMatchObject({ losses: 1, goalsAgainst: 2 });
    expect(
      standings([IDS.club, IDS.secondClub], [fixture], [{ ...result, homeGoals: 1 }])[0]?.draws,
    ).toBe(1);
    const rule = COMPETITIONS[0];
    if (!rule) throw new Error('Regra ausente');
    const fakeTable = Array.from({ length: 20 }, (_, index) => ({
      ...table[0]!,
      id: String(index),
    }));
    const places = qualificationPlaces(fakeTable, rule);
    expect(places.libertadores).toHaveLength(4);
    expect(places.sulAmericana).toHaveLength(5);
    expect(places.relegated).toHaveLength(4);
    expect(new Set([...places.libertadores, ...places.sulAmericana]).size).toBe(9);
    expect(qualificationPlaces(fakeTable, { ...rule, relegate: 0 }).relegated).toEqual([]);
  });
});
