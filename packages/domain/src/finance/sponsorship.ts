import { GAMEPLAY, type ClubSnapshot } from '@football/shared';
import { SPONSORSHIP_BASELINES } from './sponsorship-baselines.js';
/** Recurring league-round sponsorship, stored in cents (HC$ 1 = 100 cents). */
export function roundSponsorship(club: ClubSnapshot, marketingLevel: number): number {
  const baseline = SPONSORSHIP_BASELINES[club.id];
  if (baseline) {
    // A fixed initial contract: spending more on wages never increases sponsorship.
    // Marketing changes the contract by 2% per level, with a bounded bonus.
    const factor = Math.max(0.8, Math.min(1.2, 1 + (marketingLevel - baseline[1]) * 0.02));
    return Math.round((baseline[0] * factor) / 10000) * 10000;
  }
  const divisionBonus: Record<string, number> = {
    A: 600000,
    B: 300000,
    C: 125000,
    D: 0,
    REGIONAL: 0,
  };
  return (
    GAMEPLAY.startingSponsorCents +
    marketingLevel * GAMEPLAY.marketingSponsorCents +
    (marketingLevel >= 3 ? GAMEPLAY.marketingSponsorCents : 0) +
    (divisionBonus[club.division] ?? 0)
  );
}
