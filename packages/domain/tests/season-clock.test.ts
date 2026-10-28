import { describe, expect, it } from 'vitest';
import type { Fixture } from '@football/shared';
import {
  createWorld,
  nextRealMatchTime,
  scheduledBatches,
  realFixtureTime,
  pendingFixtures,
  playNextBatch,
} from '../src/index.js';
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
});
