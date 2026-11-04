import { describe, expect, it } from 'vitest';
import { simulateMatch } from '../src/index.js';
import { redCardEffects, redCardFatigueFactor } from '../src/simulation/red-card-effects.js';
import { FORMATIONS, type MatchResult } from '@football/shared';
import { playerInput, stadiumInput } from '../../../tests/fixtures/domain.js';

describe('numerical disadvantage after a red card', () => {
  it('penalizes attack and coverage increasingly with time and additional dismissals', () => {
    expect(redCardEffects(11, 11, 0)).toEqual({ attack: 1, exposure: 1, movement: 1 });
    const early = redCardEffects(10, 11, 0);
    const tired = redCardEffects(10, 11, 60);
    expect(tired.attack).toBeLessThan(early.attack);
    expect(tired.exposure).toBeGreaterThan(early.exposure);
    expect(redCardEffects(9, 11, 60).exposure).toBeGreaterThan(tired.exposure);
    expect(redCardEffects(10, 10, 60)).toMatchObject({ attack: 1, exposure: 1 });
  });

  it('charges fatigue only for time actually spent short-handed, including substitutes', () => {
    const actions = [
      { type: 'red', side: 'home', playerId: 'sent-off', minute: 30 },
    ] as MatchResult['actions'];
    expect(redCardFatigueFactor('starter', 'home', 0, 90, actions)).toBeCloseTo(
      1 + (0.25 * 60) / 90,
    );
    expect(redCardFatigueFactor('reserve', 'home', 65, 25, actions)).toBe(1.25);
    expect(redCardFatigueFactor('left', 'home', 0, 20, actions)).toBe(1);
    expect(redCardFatigueFactor('sent-off', 'home', 0, 30, actions)).toBe(1);
    expect(redCardFatigueFactor('opponent', 'away', 0, 90, actions)).toBe(1);
  });

  it('stops minutes and on-ball actions at dismissal without replacing the sent-off player', () => {
    const home = FORMATIONS['4-3-3'].map((slot, i) =>
      playerInput({ id: 'home-' + i, position: slot.position }),
    );
    const away = FORMATIONS['4-3-3'].map((slot, i) =>
      playerInput({ id: 'away-' + i, position: slot.position }),
    );
    const id = home[5]!.id;
    const r = simulateMatch(
      {
        id: 'red-test',
        competitionId: 'audit',
        round: 0,
        homeId: 'home',
        awayId: 'away',
        scheduledAt: 0,
        neutral: true,
      },
      home,
      away,
      stadiumInput(),
      42,
      undefined,
      undefined,
      undefined,
      {
        scenarioDismissals: [{ side: 'home', playerId: id, minute: 30 }],
      },
    );
    expect(r.minutesPlayed?.[id]).toBe(30);
    expect(r.actions?.some((a) => a.type === 'red' && a.playerId === id)).toBe(true);
    expect(r.actions?.filter((a) => a.minute > 30 && a.playerId === id)).toEqual([]);
    expect(r.substitutions?.some((s) => s.out === id)).toBe(false);
  });

  it('isolates zero, one and two scheduled expulsions at their actual minutes', () => {
    const home = FORMATIONS['4-3-3'].map((slot, i) =>
      playerInput({ id: 'home-' + i, position: slot.position }),
    );
    const away = FORMATIONS['4-3-3'].map((slot, i) =>
      playerInput({ id: 'away-' + i, position: slot.position }),
    );
    for (const minutes of [[], [30], [30, 60], [0, 0]]) {
      const events = minutes.map((minute, index) => ({
        side: 'home' as const,
        playerId: home[index + 2]!.id,
        minute,
      }));
      const r = simulateMatch(
        {
          id: 'red-isolation',
          competitionId: 'audit',
          round: 0,
          homeId: 'home',
          awayId: 'away',
          scheduledAt: 0,
          neutral: true,
        },
        home,
        away,
        stadiumInput(),
        123,
        undefined,
        undefined,
        undefined,
        { scenarioOnlyScheduledDismissals: true, scenarioDismissals: events },
      );
      expect(r.actions?.filter((a) => a.type === 'red')).toHaveLength(minutes.length);
      for (const event of events) expect(r.minutesPlayed?.[event.playerId]).toBe(event.minute);
    }
  });
});
