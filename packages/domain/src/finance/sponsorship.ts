import { GAMEPLAY, type ClubSnapshot } from '@football/shared';
/** Recurring league-round sponsorship, stored in cents (HC$ 1 = 100,000). */
export function roundSponsorship(club: ClubSnapshot, marketingLevel: number): number {
  const divisionBonus: Record<string, number> = {
    A: 600000000,
    B: 300000000,
    C: 125000000,
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
