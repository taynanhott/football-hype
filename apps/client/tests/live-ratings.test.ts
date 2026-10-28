import { describe, it, expect } from 'vitest';
import type { MatchResult } from '@football/shared';
import { livePlayerRatings, visibleRatingActions } from '../src/features/matches/live-statistics';
const positions = {
  striker: { position: 'ST' },
  assist: { position: 'CM' },
  keeper: { position: 'GK' },
  defender: { position: 'CB' },
};
const result: MatchResult = {
  status: 'finished',
  fixtureId: 'live',
  homeGoals: 1,
  awayGoals: 0,
  attendance: 0,
  revenue: 0,
  seed: 1,
  scorers: [],
  lineups: { home: ['striker', 'assist'], away: ['keeper', 'defender'] },
  ratings: { striker: 8.2, assist: 7, keeper: 5.2, defender: 4.4 },
  actions: [
    { minute: 0, type: 'kickoff', side: 'home', x: 0, z: 0 },
    { minute: 10, type: 'dribble', side: 'home', playerId: 'striker', x: 0, z: 0 },
    {
      minute: 20,
      type: 'shot',
      side: 'home',
      playerId: 'striker',
      keeperId: 'keeper',
      outcome: 'goal',
      onTarget: true,
      x: 0,
      z: 20,
    },
    {
      minute: 20,
      type: 'goal',
      side: 'home',
      playerId: 'striker',
      assistId: 'assist',
      x: 0,
      z: 20,
    },
    { minute: 21, type: 'kickoff', side: 'away', x: 0, z: 0 },
    { minute: 70, type: 'red', side: 'away', playerId: 'defender', x: 0, z: 0 },
  ],
};
describe('notas ao vivo', () => {
  it('começa em 6 sem expor as notas finais e evolui conforme os lances', () => {
    expect(livePlayerRatings(result, 0, positions)).toEqual({
      striker: 6,
      assist: 6,
      keeper: 6,
      defender: 6,
    });
    expect(livePlayerRatings(result, 10, positions).striker).toBe(6.1);
    expect(livePlayerRatings(result, 0, positions).striker).not.toBe(result.ratings?.striker);
  });
  it('só credita gol, assistência e gol sofrido quando o gol aparece na transmissão', () => {
    expect(livePlayerRatings(result, 20.5, positions).striker).toBe(6.1);
    expect(livePlayerRatings(result, 20.5, positions).keeper).toBe(6);
    expect(visibleRatingActions(result, 20.5).some((a) => a.type === 'goal')).toBe(false);
    const live = livePlayerRatings(result, 21, positions);
    expect(live.striker).toBe(7.3);
    expect(live.assist).toBe(6.6);
    expect(live.keeper).toBe(5.2);
    expect(live.defender).toBe(5.7);
  });
  it('oculta cartões futuros e mostra a nota final correta ao encerrar', () => {
    expect(livePlayerRatings(result, 69, positions).defender).toBe(5.7);
    expect(livePlayerRatings(result, 70, positions).defender).toBe(3.7);
    expect(livePlayerRatings(result, 90, positions)).toEqual(result.ratings);
    expect(result.ratings?.defender).toBe(4.4);
  });
});
