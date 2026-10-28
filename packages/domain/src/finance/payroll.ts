import { GAMEPLAY, roundMoney, type ClubSnapshot, type PlayerSnapshot } from '@football/shared';

export function settleRoundFinance(
  club: ClubSnapshot,
  players: readonly PlayerSnapshot[],
  ticketRevenue: number,
  marketingLevel: number,
  existingDebt: number,
) {
  const wages = roundMoney(
    players.reduce((sum, player) => sum + player.salary.cents, 0) / GAMEPLAY.salaryPeriodsPerMonth,
  );
  const sponsorship =
    GAMEPLAY.startingSponsorCents + marketingLevel * GAMEPLAY.marketingSponsorCents;
  const available = roundMoney(club.balance.cents + ticketRevenue + sponsorship);
  const debt = roundMoney(Math.max(0, existingDebt + wages - available));
  const cents = roundMoney(Math.max(0, available - wages - existingDebt));
  return { club: { ...club, balance: { ...club.balance, cents } }, wages, sponsorship, debt };
}
