import { roundMoney, type ClubSnapshot, type WorldState } from '@football/shared';
import { scheduledFixtures } from '../competitions/fixtures.js';
import { clubResults } from '../game/history-index.js';
import { financialMonth } from './financial-management.js';
import { projectTicketDemand } from './match-demand.js';
import { shareMatchRevenue } from './gate-sharing.js';
import { roundSponsorship } from './sponsorship.js';
import { ECONOMY_BASELINES } from './economy-baselines.js';
const contractsCache = new WeakMap<WorldState, Map<string, Contract>>();
type Contract = NonNullable<NonNullable<WorldState['management']>['monthlySponsorshipContract']>;
/** Lock commercial terms to the original economics and the month's known calendar. */
export function sponsorshipContract(state: WorldState, month: string): Contract {
  const saved = state.management?.monthlySponsorshipContract;
  if (saved?.month === month) return saved;
  const cached = contractsCache.get(state)?.get(month);
  if (cached) return cached;
  const clubs: Contract['clubs'] = {};
  const expected = new Map<string, number[]>();
  for (const game of scheduledFixtures(state)) {
    if (financialMonth(game.scheduledAt) !== month) continue;
    const profile = ECONOMY_BASELINES[game.homeId];
    if (!profile) continue;
    for (const [i, factor] of [0.85, 0.965, 1.08].entries()) {
      const demand = projectTicketDemand(
        {
          capacity: profile.capacity,
          commerce: profile.commerce,
          selloutPriceCents: 50,
          minimumCrowdPriceCents: 400,
          demandFactor: factor,
        },
        100,
      );
      const revenue =
        demand.ticketRevenue +
        roundMoney(demand.consumptionRevenue * (profile.marketing >= 4 ? 1.2 : 1));
      const gate = shareMatchRevenue(demand.ticketRevenue, revenue);
      for (const [id, value] of [
        [game.homeId, gate.home],
        [game.awayId, gate.away],
      ] as const) {
        const amounts = expected.get(id) ?? [0, 0, 0];
        amounts[i] = (amounts[i] ?? 0) + value;
        expected.set(id, amounts);
      }
    }
  }
  for (const club of Object.values(state.clubs.byId)) {
    const profile = ECONOMY_BASELINES[club.id];
    const amounts = expected.get(club.id) ?? [0, 0, 0];
    const fallback =
      roundSponsorship(club, state.centers.byId[club.trainingCenterId]?.levels.marketing ?? 1) * 4;
    const values = profile
      ? profile.targets.map((target, i) => Math.max(0, profile.cost + target - (amounts[i] ?? 0)))
      : [fallback * 0.9, fallback, fallback * 1.1];
    clubs[club.id] = {
      low: Math.round(values[0]!),
      normal: Math.round(values[1]!),
      high: Math.round(values[2]!),
    };
  }
  const result = { month, clubs };
  const cache = contractsCache.get(state) ?? new Map<string, Contract>();
  cache.set(month, result);
  contractsCache.set(state, cache);
  return result;
}
/** Commercial performance is bounded; current payroll never increases the contract. */
export function monthlySponsorship(state: WorldState, club: ClubSnapshot, contract: Contract) {
  const terms = contract.clubs[club.id];
  if (!terms) return 0;
  const recent = clubResults(state, club.id).slice(-5);
  const form = recent.length
    ? recent.reduce((sum, r) => {
        const diff = r.homeId === club.id ? r.homeGoals - r.awayGoals : r.awayGoals - r.homeGoals;
        return sum + (diff > 0 ? 3 : diff === 0 ? 1 : 0);
      }, 0) /
      (recent.length * 3)
    : 0.5;
  const amount =
    form <= 0.5
      ? terms.low + (terms.normal - terms.low) * form * 2
      : terms.normal + (terms.high - terms.normal) * (form - 0.5) * 2;
  const baseline = ECONOMY_BASELINES[club.id];
  const marketing = state.centers.byId[club.trainingCenterId]?.levels.marketing ?? 1;
  const factor = baseline
    ? Math.max(0.8, Math.min(1.2, 1 + (marketing - baseline.marketing) * 0.02))
    : 1;
  return Math.round(amount * factor);
}
export function accrueSponsorship(state: WorldState, to: number): WorldState {
  let from = state.management?.sponsorshipAccruedThrough ?? state.lastProcessedAt;
  if (to <= from) return state;
  const clubs = { ...state.clubs.byId };
  const history = [...(state.management?.financialHistory ?? [])];
  const historyIndex = new Map(
    history.map((row, i) => [
      JSON.stringify([row.clubId, row.month, row.season ?? state.season]),
      i,
    ]),
  );
  let contract = state.management?.monthlySponsorshipContract;
  while (from < to) {
    const month = financialMonth(from);
    contract = sponsorshipContract(
      { ...state, management: { ...state.management, monthlySponsorshipContract: contract } },
      month,
    );
    const date = new Date(from - 10800000);
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 3);
    const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 3);
    const until = Math.min(to, end);
    for (const club of Object.values(clubs)) {
      const value = monthlySponsorship(state, club, contract);
      const amount =
        Math.floor((value * (until - start)) / (end - start)) -
        Math.floor((value * (from - start)) / (end - start));
      const key = JSON.stringify([club.id, month, state.season]);
      let rowIndex = historyIndex.get(key);
      if (rowIndex === undefined) {
        rowIndex = history.length;
        historyIndex.set(key, rowIndex);
        history.push({
          clubId: club.id,
          month,
          season: state.season,
          income: 0,
          expenses: 0,
          fixedCosts: 0,
        });
      }
      history[rowIndex] = { ...history[rowIndex]!, income: history[rowIndex]!.income + amount };
      clubs[club.id] = {
        ...club,
        balance: { ...club.balance, cents: club.balance.cents + amount },
      };
    }
    from = until;
  }
  return {
    ...state,
    clubs: { ...state.clubs, byId: clubs },
    management: {
      ...state.management,
      financialHistory: history,
      sponsorshipAccruedThrough: to,
      monthlySponsorshipContract: contract,
    },
  };
}
