import type { ClubSnapshot, GameEvent, WorldState } from '@football/shared';
import { scheduledFixtures } from '../competitions/fixtures.js';
import { clubPayroll, financialMonth, monthlyFinancialReport } from './financial-management.js';
import { monthlyStructureCost } from './facility-costs.js';
import { indexDemandResults, matchDemand } from './match-demand.js';
import { shareMatchRevenue } from './gate-sharing.js';
import { monthlySponsorship, sponsorshipContract } from './calendar-sponsorship.js';

/** Read-only forecast: actual transactions plus known remaining matches, without speculative transfers. */
export function currentMonthForecast(
  state: WorldState,
  club: ClubSnapshot,
  ledger: readonly Pick<GameEvent, 'sequence' | 'occurredAt' | 'balances'>[],
) {
  const current = monthlyFinancialReport(state, club.id, ledger).current;
  const month = financialMonth(state.lastProcessedAt);
  const fixtures = scheduledFixtures(state);
  const index = new Map(fixtures.map((f) => [f.id, f]));
  const histories = indexDemandResults(state, index);
  const played = new Set(state.results.map((r) => r.fixtureId));
  const remaining = fixtures.filter(
    (f) =>
      !played.has(f.id) &&
      f.scheduledAt >= state.lastProcessedAt &&
      financialMonth(f.scheduledAt) === month,
  );
  let matchRevenue = 0;
  let attendance = 0;
  let admissions = 0;
  let homeGames = 0;
  for (const result of state.results) {
    const fixture = index.get(result.fixtureId);
    if (!fixture || fixture.homeId !== club.id || financialMonth(fixture.scheduledAt) !== month)
      continue;
    attendance += result.attendance;
    admissions +=
      result.attendance * (result.ticketPriceCents ?? state.homeTicketPrices?.[club.id] ?? 100);
    homeGames++;
  }
  for (const fixture of remaining) {
    if (fixture.homeId !== club.id && fixture.awayId !== club.id) continue;
    const demand = matchDemand(state, fixture, undefined, index, histories);
    const share = shareMatchRevenue(demand.ticketRevenue, demand.revenue);
    matchRevenue += fixture.homeId === club.id ? share.home : share.away;
    if (fixture.homeId === club.id) {
      attendance += demand.attendance;
      admissions += demand.attendance * demand.priceCents;
      homeGames++;
    }
  }
  const monthDate = new Date(state.lastProcessedAt - 10800000);
  const monthStart = Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1, 3);
  const monthEnd = Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1, 3);
  const monthly = monthlySponsorship(state, club, sponsorshipContract(state, month));
  const paidThrough = Math.max(
    state.lastProcessedAt,
    state.management?.sponsorshipAccruedThrough ?? state.lastProcessedAt,
  );
  const sponsorship = Math.max(
    0,
    monthly - Math.floor((monthly * (paidThrough - monthStart)) / (monthEnd - monthStart)),
  );
  const fixedCosts = clubPayroll(state, club) + monthlyStructureCost(state, club);
  const pendingCosts = Math.max(0, fixedCosts - current.fixedCosts);
  const income = current.income + matchRevenue + sponsorship;
  const expenses = current.expenses + pendingCosts;
  return {
    profit: income - expenses,
    income,
    expenses,
    matchRevenue,
    sponsorship,
    pendingCosts,
    remainingGames: remaining.filter((f) => f.homeId === club.id || f.awayId === club.id).length,
    averageAttendance: homeGames ? Math.round(attendance / homeGames) : 0,
    averageTicketPrice: attendance ? Math.round(admissions / attendance) : 0,
  };
}
