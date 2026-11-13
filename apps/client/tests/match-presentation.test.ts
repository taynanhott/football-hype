import { describe, it, expect } from 'vitest';
import { presentationGameMinute } from '../src/three/match-presentation';
import type { MatchResult } from '@football/shared';
type Action = NonNullable<MatchResult['actions']>[number];
describe('tempo de apresentação das jogadas', () => {
  const actions: Action[] = [
    { minute: 0, type: 'kickoff', side: 'home', x: 0, z: 0 },
    { minute: 10, type: 'shot', side: 'home', x: 0, z: 30 },
    { minute: 10.15, type: 'save', side: 'away', x: 0, z: 47 },
    { minute: 10.35, type: 'dribble', side: 'home', x: 2, z: 39 },
    { minute: 11, type: 'pass', side: 'home', x: 2, z: 39 },
    { minute: 46, type: 'pass', side: 'home', x: 0, z: 0 },
  ];
  it('mantém 90 segundos e a passagem entre os tempos sem recuar o relógio', () => {
    expect(presentationGameMinute(actions, 0)).toBe(0);
    expect(presentationGameMinute(actions, 45)).toBe(45);
    expect(presentationGameMinute(actions, 90)).toBe(90);
    let previous = 0;
    for (let clock = 0; clock < 90; clock += 0.05) {
      const value = presentationGameMinute(actions, clock);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
  it('mantém velocidade uniforme nas defesas e rebotes', () => {
    let saveTime = 0;
    for (let clock = 0; clock < 45; clock += 0.01) {
      const value = presentationGameMinute(actions, clock);
      if (value >= 10.15 && value < 10.35) saveTime += 0.01;
    }
    expect(saveTime).toBeCloseTo(0.2, 1);
    expect(actions[2]!.minute).toBe(10.15);
  });
});
