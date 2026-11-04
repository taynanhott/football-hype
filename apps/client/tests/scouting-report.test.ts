import { describe, expect, it } from 'vitest';
import { scoutingReport } from '../src/features/players/scouting-report';

const player = { clubId: 'other', overall: 85, potential: 90 };
describe('visibility provided by the scout', () => {
  it('hides external overall, potential and quality tier at level one', () => {
    expect(scoutingReport(player, 'own', 1)).toMatchObject({
      overall: '?',
      potential: '?',
      tier: 'unknown',
      minimum: null,
      maximum: null,
    });
    expect(scoutingReport({ ...player, clubId: null }, 'own', 1).hidden).toBe(true);
  });
  it.each([
    [2, '74–99'],
    [3, '78–99'],
    [4, '82–98'],
    [5, '86–94'],
  ] as const)('uses the level %i potential interval', (level, potential) => {
    expect(scoutingReport(player, 'own', level)).toMatchObject({
      overall: 85,
      potential,
      hidden: false,
    });
  });
  it('keeps known club, academy and owned-loan players exact at any level', () => {
    expect(scoutingReport({ ...player, clubId: 'own' }, 'own', 1).potential).toBe('90');
    expect(
      scoutingReport({ ...player, clubId: null, academyClubId: 'own' }, 'own', 1).overall,
    ).toBe(85);
    expect(scoutingReport(player, 'own', 1, true).overall).toBe(85);
    expect(scoutingReport({ ...player, academyClubId: 'own' }, 'own', 1).hidden).toBe(true);
  });
  it('bounds reports to valid ratings and reacts to a scout upgrade', () => {
    expect(scoutingReport({ ...player, potential: 99 }, 'own', 2).potential).toBe('83–99');
    expect(scoutingReport({ ...player, potential: 3 }, 'own', 2).potential).toBe('1–19');
    expect(scoutingReport(player, 'own', 1).hidden).toBe(true);
    expect(scoutingReport(player, 'own', 2).overall).toBe(85);
    expect(scoutingReport(player, undefined, 1).hidden).toBe(true);
  });
});
