import { describe, expect, it } from 'vitest';
import { actionChance, actionQuality } from '../src/simulation/action-quality.js';

describe('individual action quality', () => {
  it('reduz todas as ações com a condição atual, preservando o overall base', () => {
    const player = { overall: 90, position: 'ST' as const };
    for (const skill of ['passing', 'finishing', 'defending', 'dribbling', 'keeping'] as const) {
      expect(actionQuality(player, skill, 60)).toBeLessThan(actionQuality(player, skill, 90));
    }
    expect(player.overall).toBe(90);
    expect(actionQuality({ overall: 90, position: 'ST' }, 'finishing', 30)).toBeLessThan(
      actionQuality({ overall: 80, position: 'ST' }, 'finishing', 100),
    );
  });
  it('rewards stronger attackers and counters them with stronger defenders', () => {
    const strong = actionQuality({ overall: 90, position: 'ST' }, 'finishing');
    const weak = actionQuality({ overall: 55, position: 'ST' }, 'finishing');
    expect(actionChance(0.2, strong, 70)).toBeGreaterThan(actionChance(0.2, weak, 70));
    expect(actionChance(0.2, strong, 90)).toBeLessThan(actionChance(0.2, strong, 55));
  });
  it('gives position specialists an advantage without guaranteeing success', () => {
    expect(actionQuality({ overall: 70, position: 'CB' }, 'defending')).toBeGreaterThan(
      actionQuality({ overall: 70, position: 'ST' }, 'defending'),
    );
    for (const base of [0.025, 0.22, 0.55, 0.76]) {
      expect(actionChance(base, 99, 1)).toBeLessThan(1);
      expect(actionChance(base, 1, 99)).toBeGreaterThan(0);
    }
  });
});
