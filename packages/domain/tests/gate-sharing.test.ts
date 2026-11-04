import { describe, expect, it } from 'vitest';
import { shareMatchRevenue } from '../src/finance/gate-sharing.js';

describe('match gate sharing', () => {
  it('gives the visitor 30% of admission and keeps commerce with the host', () => {
    expect(shareMatchRevenue(100000, 125000)).toEqual({ home: 95000, away: 30000 });
  });
  it('preserves every cent including fractional shares and empty gates', () => {
    for (const ticket of [0, 1, 99, 101, 1234567]) {
      const shares = shareMatchRevenue(ticket, ticket + 123);
      expect(shares.home + shares.away).toBe(ticket + 123);
      expect(shares.away).toBeLessThanOrEqual(ticket * 0.3);
    }
    expect(shareMatchRevenue(0, 0)).toEqual({ home: 0, away: 0 });
  });
});
