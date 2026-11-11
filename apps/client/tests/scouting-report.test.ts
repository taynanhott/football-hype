import { describe, expect, it } from 'vitest';
import { scoutingReport } from '../src/features/players/scouting-report';

const player = { id: 'scouted-player', clubId: 'other', overall: 85, potential: 90 };
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
  it('keeps asymmetric reports stable and nested across upgrades', () => {
    for (let id = 0; id < 100; id++) {
      const target = { ...player, id: String(id), overall: 40, potential: 70 };
      let previous = { minimum: 1, maximum: 99 };
      for (const level of [2, 3, 4, 5]) {
        const report = scoutingReport(target, 'own', level);
        expect(report).toEqual(scoutingReport(target, 'own', level));
        expect(report.minimum!).toBeLessThanOrEqual(70);
        expect(report.maximum!).toBeGreaterThanOrEqual(70);
        expect(report.minimum!).toBeGreaterThanOrEqual(previous.minimum);
        expect(report.maximum!).toBeLessThanOrEqual(previous.maximum);
        expect((report.minimum! + report.maximum!) / 2).not.toBe(70);
        expect(report.maximum! - 70).toBeLessThan(70 - report.minimum!);
        previous = { minimum: report.minimum!, maximum: report.maximum! };
      }
    }
  });
  it('varies widths and asymmetry across players and scout levels', () => {
    const widths = new Set<number>();
    const ratios = new Set<number>();
    let changingRatios = 0;
    for (let id = 0; id < 100; id++) {
      const playerRatios = new Set<number>();
      for (const level of [2, 3, 4, 5]) {
        const report = scoutingReport(
          { ...player, id: String(id), overall: 1, potential: 60 },
          'own',
          level,
        );
        const below = 60 - report.minimum!;
        const above = report.maximum! - 60;
        widths.add(below + above);
        ratios.add(below / above);
        playerRatios.add(below / above);
      }
      if (playerRatios.size > 1) changingRatios++;
    }
    expect(widths.size).toBeGreaterThan(10);
    expect(ratios.size).toBeGreaterThan(10);
    expect(changingRatios).toBeGreaterThan(90);
  });
  it('preserves the smaller upper margin when overall clips the lower bound', () => {
    for (const overall of [85, 88, 89, 90]) {
      for (const level of [2, 3, 4, 5]) {
        const report = scoutingReport({ ...player, overall }, 'own', level);
        const below = player.potential - report.minimum!;
        const above = report.maximum! - player.potential;
        if (below > 0) expect(above).toBeLessThan(below);
        else expect(above).toBe(0);
      }
    }
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
    for (const potential of [3, 90, 99]) {
      const report = scoutingReport({ ...player, overall: 1, potential }, 'own', 2);
      expect(report.minimum!).toBeGreaterThanOrEqual(1);
      expect(report.maximum!).toBeLessThanOrEqual(99);
      expect(report.minimum!).toBeLessThanOrEqual(potential);
      expect(report.maximum!).toBeGreaterThanOrEqual(potential);
    }
    expect(scoutingReport(player, 'own', 1).hidden).toBe(true);
    expect(scoutingReport(player, 'own', 2).overall).toBe(85);
    expect(scoutingReport(player, undefined, 1).hidden).toBe(true);
  });
});
