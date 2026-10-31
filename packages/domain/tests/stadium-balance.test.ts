import { describe, expect, it } from 'vitest';
import { stadiumBenefits } from '../src/finance/stadium-benefits.js';
import { maintenanceForLevel } from '../src/finance/facility-costs.js';
import type { StadiumSnapshot } from '@football/shared';

const stadium = (level: number) =>
  ({
    pitchLevel: level,
    surroundingsLevel: level,
    sectors: Array.from({ length: 4 }, () => ({ level })),
    commerce: { foodLevel: level, shirtsLevel: level, hospitalityLevel: level },
  }) as StadiumSnapshot;

describe('stadium balance', () => {
  it('keeps quality improving at every level, including the final upgrade', () => {
    for (let level = 1; level < 5; level++) {
      const before = stadiumBenefits(stadium(level));
      const after = stadiumBenefits(stadium(level + 1));
      expect(after.interest).toBeGreaterThan(before.interest);
      expect(after.ticketPremium).toBeGreaterThan(before.ticketPremium);
    }
  });
  it('makes commercial upgrades profitable at 20,000 spectators twice monthly', () => {
    for (const [target, weight] of [
      ['food', 1.5],
      ['shirts', 1],
      ['hospitality', 4],
    ] as const) {
      for (let level = 1; level < 5; level++) {
        const monthlyExtraRevenue = (20000 * 2 * 5000 * weight) / 20;
        expect(monthlyExtraRevenue).toBeGreaterThan(
          maintenanceForLevel(level + 1, target) - maintenanceForLevel(level, target),
        );
      }
    }
  });
});
