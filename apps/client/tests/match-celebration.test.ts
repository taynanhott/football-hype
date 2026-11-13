import { describe, expect, it } from 'vitest';
import { MATCH_DURATION_MS, type MatchResult } from '@football/shared';
import { recentMatchEvent } from '../src/three/match-celebration';
import { visibleActionMinute } from '../src/three/match-playback';

describe('reações locais da transmissão', () => {
  const actions: NonNullable<MatchResult['actions']> = [
    { minute: 10, type: 'goal', side: 'home', x: 0, z: 52 },
    { minute: 30, type: 'goal', side: 'away', x: 0, z: -52 },
    { minute: 90, type: 'red', side: 'home', x: 12, z: 5 },
  ];
  const minutes = (ms: number) => (ms / MATCH_DURATION_MS) * 90;
  const homeGoal = visibleActionMinute(actions, 0);
  const awayGoal = visibleActionMinute(actions, 1);
  it('mantém apenas a torcida que marcou ativa até terminar o grito', () => {
    expect(recentMatchEvent(actions, 9, ['goal'], 5500)).toBeUndefined();
    expect(recentMatchEvent(actions, homeGoal + minutes(5499), ['goal'], 5500)?.side).toBe('home');
    expect(recentMatchEvent(actions, homeGoal + minutes(5501), ['goal'], 5500)).toBeUndefined();
    expect(recentMatchEvent(actions, awayGoal + minutes(100), ['goal'], 5500)?.side).toBe('away');
  });
  it('um novo gol substitui a reação anterior mesmo se os gritos se sobrepõem', () => {
    expect(recentMatchEvent(actions, awayGoal, ['goal'], MATCH_DURATION_MS)?.side).toBe('away');
  });
  it('encerra a exibição do cartão inclusive depois dos 90 minutos', () => {
    expect(recentMatchEvent(actions, 90, ['yellow', 'red'], 2500)?.type).toBe('red');
    expect(recentMatchEvent(actions, 90 + minutes(2501), ['yellow', 'red'], 2500)).toBeUndefined();
  });
});
