import { describe, expect, it } from 'vitest';
import {
  FACILITY_ECONOMY,
  upgradePrice,
  maintenanceForLevel,
} from '../src/finance/facility-costs.js';

describe('precisão dos custos das estruturas', () => {
  it('arredonda melhorias e manutenção para cima em múltiplos de HC$ 100', () => {
    for (const [target, item] of Object.entries(FACILITY_ECONOMY)) {
      for (let level = 1; level <= 5; level++) {
        const upgrade = upgradePrice(level, target);
        const maintenance = maintenanceForLevel(level, target);
        expect(upgrade % 10000).toBe(0);
        expect(maintenance % 10000).toBe(0);
        expect(upgrade).toBeGreaterThanOrEqual(item.upgrade * item.growth ** (level - 1));
        const growth = 1.65;
        expect(maintenance).toBeGreaterThanOrEqual(item.maintenance * growth ** (level - 1));
      }
    }
  });
});
