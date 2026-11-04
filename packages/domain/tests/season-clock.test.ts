import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Fixture } from '@football/shared';
import {
  createWorld,
  nextRealMatchTime,
  scheduledBatches,
  realFixtureTime,
  pendingFixtures,
  playNextBatch,
  importDataset,
  scheduledFixtures,
  advanceGameDays,
  gameDayStart,
  GAME_DAY_MS,
  realTimeGameDate,
} from '../src/index.js';
import { fixtureRoundKey, ROUND_CALENDAR_VERSION } from '../src/competitions/round-calendar.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const time = (value: string) => Date.parse(`2026-10-${value}-03:00`);
const fixture = (
  id: string,
  competitionId: string,
  homeId: string,
  awayId: string,
  scheduledAt = 100,
): Fixture => ({ id, competitionId, homeId, awayId, scheduledAt, round: 0 });

describe('relógio persistente da temporada', () => {
  it('usa os oito horários de Brasília e atravessa a meia-noite', () => {
    let at = time('28T07:59:59');
    const slots = [];
    for (let i = 0; i < 9; i++) {
      at = nextRealMatchTime(at);
      slots.push(new Date(at).toISOString());
    }
    expect(slots).toEqual([
      '2026-10-28T11:00:00.000Z',
      '2026-10-28T13:30:00.000Z',
      '2026-10-28T16:00:00.000Z',
      '2026-10-28T18:30:00.000Z',
      '2026-10-28T21:00:00.000Z',
      '2026-10-28T23:30:00.000Z',
      '2026-10-29T01:00:00.000Z',
      '2026-10-29T02:30:00.000Z',
      '2026-10-29T11:00:00.000Z',
    ]);
  });
  it('mantém uma rodada inteira junta e separa torneios com clubes em comum', () => {
    const a = fixture('a', 'serie-a', '1', '2');
    const b = fixture('b', 'serie-a', '3', '4');
    const cup = fixture('cup', 'copa-brasil', '1', '3');
    const other = fixture('other', 'serie-b', '5', '6');
    const batches = scheduledBatches([b, cup, other, a]);
    expect(batches.flat()).toHaveLength(4);
    expect(batches.find((batch) => batch.includes(a))).toContain(b);
    expect(batches.find((batch) => batch.includes(a))).not.toContain(cup);
    for (const batch of batches) {
      const clubs = batch.flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(clubs).size).toBe(clubs.length);
    }
  });
  it('antecipa a temporada sem perder os dias de descanso e realoca o próximo horário', () => {
    const now = time('28T07:00:00');
    const state = unwrap(
      createWorld({ id: IDS.league, userId: IDS.user, name: 'Online', mode: 'multiplayer', now }),
    );
    const pending = pendingFixtures(state);
    const first = scheduledBatches(pending)[0]!;
    expect(realFixtureTime(state, pending, first[0]!)).toBe(time('28T08:00:00'));
    const next = unwrap(playNextBatch(state, now));
    expect(next.lastProcessedAt).toBe(first[0]!.scheduledAt);
    expect(next.nextScheduledAt).toBe(time('28T08:00:00'));
    expect(next.results.every((result) => result.startedAt === now)).toBe(true);
    const automatic = unwrap(playNextBatch(state, state.nextScheduledAt));
    expect(automatic.nextScheduledAt).toBe(time('28T10:30:00'));
    expect(automatic.players).toEqual(next.players);
  });
  it('às 14h antecipa a rodada das 15h30 e desloca todas as seguintes sem mudar as datas do jogo', () => {
    const now = time('28T14:00:00');
    const state = unwrap(
      createWorld({ id: IDS.league, userId: IDS.user, name: 'Horários', mode: 'multiplayer', now }),
    );
    const [home, away] = state.clubs.ids;
    state.fixtures = [0, 1, 2, 3].map((round) => ({
      id: 'slot-' + round,
      competitionId: 'serie-a',
      round,
      homeId: home!,
      awayId: away!,
      scheduledAt: state.lastProcessedAt + (round + 1) * 3 * GAME_DAY_MS,
    }));
    state.cups = [];
    state.competitionDraws = [];
    state.regionalQualifiers = [];
    state.roundDates = Object.fromEntries(
      state.fixtures.map((f) => [fixtureRoundKey(f), f.scheduledAt]),
    );
    state.roundCalendarVersion = ROUND_CALENDAR_VERSION;
    state.nextScheduledAt = time('28T15:30:00');
    const initial = pendingFixtures(state);
    expect(initial.map((f) => realFixtureTime(state, initial, f))).toEqual([
      time('28T15:30:00'),
      time('28T18:00:00'),
      time('28T20:30:00'),
      time('28T22:00:00'),
    ]);
    const next = unwrap(playNextBatch(state, now));
    const pending = pendingFixtures(next);
    expect(pending.map((f) => realFixtureTime(next, pending, f))).toEqual([
      time('28T15:30:00'),
      time('28T18:00:00'),
      time('28T20:30:00'),
    ]);
    expect(next.fixtures).toEqual(state.fixtures);
    expect(next.calendarAnchor).toEqual({ realAt: now, gameAt: next.lastProcessedAt });
    expect(realTimeGameDate(next, pending[0]!.scheduledAt, now)).toBe(next.lastProcessedAt);
    const repeated = unwrap(playNextBatch(next, now + 120000));
    expect(repeated.nextScheduledAt).toBe(time('28T15:30:00'));
    expect(repeated.results).toHaveLength(2);
    const automatic = unwrap(playNextBatch(next, next.nextScheduledAt));
    expect(automatic.nextScheduledAt).toBe(time('28T18:00:00'));
  });
  it('usa a data efetiva após o sorteio e preserva efeitos diários e finanças em um avanço longo', () => {
    const now = time('28T14:00:00');
    const initial = unwrap(
      importDataset(
        unwrap(
          createWorld({
            id: IDS.league,
            userId: IDS.user,
            name: 'Sorteios',
            mode: 'multiplayer',
            now,
          }),
        ),
        JSON.parse(
          readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
        ),
      ),
    );
    const before = pendingFixtures(initial)[0]!.scheduledAt;
    const next = unwrap(playNextBatch(initial, now));
    const dates = new Map(scheduledFixtures(next).map((f) => [f.id, f.scheduledAt]));
    const playedDate = Math.max(...next.results.map((r) => dates.get(r.fixtureId)!));
    expect(playedDate).toBeGreaterThan(before);
    expect(next.lastProcessedAt).toBe(playedDate);
    expect(next.calendarAnchor?.gameAt).toBe(playedDate);
    let daily = initial;
    for (
      let at = gameDayStart(initial.lastProcessedAt) + GAME_DAY_MS;
      at <= gameDayStart(playedDate);
      at += GAME_DAY_MS
    )
      daily = advanceGameDays(daily, at);
    const expected = unwrap(playNextBatch(daily, now));
    expect(next.players).toEqual(expected.players);
    expect(next.centers).toEqual(expected.centers);
    expect(Object.values(next.clubs.byId).map((c) => c.balance.cents)).toEqual(
      Object.values(expected.clubs.byId).map((c) => c.balance.cents),
    );
  }, 20000);
});
