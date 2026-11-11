import { pendingSeasonClosingDates } from '../src/competitions/season-closing.js';
import { it, expect } from 'vitest';
import { createWorld, playNextBatch } from '../src/index.js';
import { seasonClosingDates, SEASON_EVENT_GAP_MS } from '../src/competitions/season-closing.js';
import { scheduleIntercontinental } from '../src/competitions/season-finale.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
it('avança pagamento, gala e fim em dias distintos sem disputar partidas extras', () => {
  const world = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Fechamento',
      mode: 'offline',
      now: Date.parse('2026-10-26T15:00:00Z'),
    }),
  );
  const at = world.lastProcessedAt,
    day = 86400000;
  const state = {
    ...world,
    fixtures: [],
    cups: [],
    seasonClosing: {
      ...seasonClosingDates(at),
      stage: 'payments' as const,
    },
  };
  const paid = unwrap(playNextBatch(state, at));
  expect(paid.lastProcessedAt).toBe(at + 2 * day);
  expect(paid.status).toBe('active');
  expect(paid.seasonClosing?.stage).toBe('gala');
  const gala = unwrap(playNextBatch(paid, at));
  expect(gala.lastProcessedAt).toBe(at + 4 * day);
  expect(gala.status).toBe('active');
  expect(gala.seasonClosing?.stage).toBe('end');
  const end = unwrap(playNextBatch(gala, at));
  expect(end.lastProcessedAt).toBe(at + 5 * day);
  expect(end.status).toBe('finished');
  expect(end.results).toEqual([]);
});

it('reserva pelo menos sete dias antes da Intercontinental e encerra a temporada em cinco dias depois da final', () => {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Recuperação',
      mode: 'offline',
      now: Date.parse('2026-10-26T15:00:00Z'),
    }),
  );
  const ids = state.clubs.ids;
  const node = {
    round: 0,
    homeId: ids[0]!,
    awayId: ids[1]!,
    leftId: null,
    rightId: null,
    scheduledAt: state.lastProcessedAt,
    legs: 1,
  };
  const scheduled = scheduleIntercontinental({
    ...state,
    cups: [
      { ...node, id: 'libertadores:final', competitionId: 'libertadores', winnerId: ids[0]! },
      { ...node, id: 'europa:final', competitionId: 'europa', winnerId: ids[1]! },
    ],
  });
  const final = scheduled.cups.find((c) => c.competitionId === 'intercontinental')!;
  expect(final.scheduledAt - state.lastProcessedAt).toBeGreaterThanOrEqual(SEASON_EVENT_GAP_MS);
  const dates = seasonClosingDates(final.scheduledAt);
  expect(dates.paymentAt - final.scheduledAt).toBe(2 * 86400000);
  expect(dates.galaAt - dates.paymentAt).toBe(2 * 86400000);
  expect(dates.endAt - dates.galaAt).toBe(86400000);
  expect(scheduleIntercontinental(scheduled)).toBe(scheduled);
});

it('não empurra o encerramento de dezembro para o ano seguinte', () => {
  const dates = seasonClosingDates(Date.parse('2026-12-13T20:00:00-03:00'));
  expect(new Date(dates.endAt).toISOString().slice(0, 10)).toBe('2026-12-18');
});

it('corrige somente datas futuras sem reescrever pagamentos e galas já ocorridos', () => {
  const at = Date.parse('2026-12-13T20:00:00-03:00'),
    day = 86400000;
  const old = {
    lastMatchAt: at,
    paymentAt: at + 7 * day,
    galaAt: at + 14 * day,
    endAt: at + 21 * day,
  };
  expect(pendingSeasonClosingDates({ ...old, stage: 'payments' }).endAt).toBe(at + 5 * day);
  const paid = pendingSeasonClosingDates({ ...old, stage: 'gala' });
  expect(paid.paymentAt).toBe(old.paymentAt);
  expect(paid.galaAt).toBe(old.paymentAt + 2 * day);
  const presented = pendingSeasonClosingDates({ ...old, stage: 'end' });
  expect(presented.galaAt).toBe(old.galaAt);
  expect(presented.endAt).toBe(old.galaAt + day);
});
