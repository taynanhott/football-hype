import { loanWage } from '../game/management.js';
import { monthlyStructureCost } from './facility-costs.js';
import { MONEY_STEPS, type ClubSnapshot, type WorldState, type GameEvent } from '@football/shared';

export function clubPayroll(state: WorldState, club: ClubSnapshot) {
  const ids = new Set([
    ...club.playerIds,
    ...Object.keys(state.management?.loans ?? {}).filter(
      (id) => state.management?.loans?.[id]?.ownerId === club.id,
    ),
  ]);
  return [...ids].reduce((sum, id) => sum + loanWage(state, id, club.id), 0);
}
/** Start just beyond the monthly expense marker, within available cash. */
export function defaultFinancialPlan(state: WorldState, club: ClubSnapshot) {
  const cash = Math.max(0, club.balance.cents);
  const expenses = clubPayroll(state, club) + monthlyStructureCost(state, club);
  const salaries = Math.min(
    cash,
    (Math.floor(expenses / MONEY_STEPS.general) + 1) * MONEY_STEPS.general,
  );
  const transfer = Math.floor((cash - salaries) / MONEY_STEPS.general) * MONEY_STEPS.general;
  return { salaries, transfer };
}
export function operatingReserve(state: WorldState, club: ClubSnapshot) {
  return Math.min(
    Math.max(0, club.balance.cents),
    monthlyStructureCost(state, club) + (state.debts[club.id] ?? 0),
  );
}
export function financialLimits(
  state: WorldState,
  club: ClubSnapshot,
  _fee = 0,
  _negotiationId?: string,
) {
  void _fee;
  void _negotiationId;
  const savedPlan = state.management?.financialPlans?.[club.id];
  const plan = savedPlan ?? defaultFinancialPlan(state, club);
  const cash = Math.max(0, club.balance.cents);
  const payroll = clubPayroll(state, club);
  const operations = monthlyStructureCost(state, club) + (state.debts[club.id] ?? 0);
  const reserve = 0;
  const transfer = Math.max(0, Math.min(plan?.transfer ?? cash, cash));
  const salary = Math.max(0, plan ? plan.salaries - payroll : cash);
  return {
    configured: Boolean(savedPlan),
    operations,
    reserve,
    transfer: Math.floor(transfer / MONEY_STEPS.general) * MONEY_STEPS.general,
    salary: Math.floor(salary / MONEY_STEPS.salary) * MONEY_STEPS.salary,
    payroll,
    salaryCap: plan?.salaries ?? payroll + cash,
  };
}
export function consumeTransferBudget(state: WorldState, clubId: string, fee: number) {
  const management = { ...state.management };
  const plan = management.financialPlans?.[clubId];
  if (plan)
    management.financialPlans = {
      ...management.financialPlans,
      [clubId]: { ...plan, transfer: Math.max(0, plan.transfer - fee) },
    };
  return management;
}
export function financialMonth(at: number) {
  return new Date(at - 10800000).toISOString().slice(0, 7);
}

// Keep gross revenue and payments separate even when the same event also settles payroll.
export function recordFinancialHistory(previous: WorldState, next: WorldState) {
  const charges = (next.management?.charges ?? []).slice(previous.management?.charges?.length ?? 0);
  const changes = next.clubs.ids.filter(
    (id) =>
      (next.clubs.byId[id]?.balance.cents ?? 0) !== (previous.clubs.byId[id]?.balance.cents ?? 0),
  );
  if (!charges.length && !changes.length) return next;
  const bookedIncome = new Map<string, number>();
  for (const [direction, entries] of [
    [-1, previous.management?.financialHistory ?? []],
    [1, next.management?.financialHistory ?? []],
  ] as const)
    for (const row of entries)
      bookedIncome.set(row.clubId, (bookedIncome.get(row.clubId) ?? 0) + direction * row.income);
  const rows = (
    next.management?.financialHistory ??
    previous.management?.financialHistory ??
    []
  ).map((row) => ({
    ...row,
    season: row.season ?? previous.season,
  }));
  const get = (clubId: string, month: string) => {
    let row = rows.find(
      (r) => r.clubId === clubId && r.month === month && r.season === next.season,
    );
    if (!row) {
      row = { clubId, month, season: next.season, income: 0, expenses: 0, fixedCosts: 0 };
      rows.push(row);
    }
    return row;
  };
  const paid = new Map<string, number>(),
    debts = { ...previous.debts };
  for (const charge of charges) {
    const payment = Math.max(
      0,
      (debts[charge.clubId] ?? 0) + charge.wages + charge.maintenance - charge.unpaid,
    );
    debts[charge.clubId] = charge.unpaid;
    paid.set(charge.clubId, (paid.get(charge.clubId) ?? 0) + payment);
    const row = get(charge.clubId, charge.month);
    row.fixedCosts += charge.wages + charge.maintenance;
    row.expenses += payment;
  }
  for (const id of new Set([...changes, ...paid.keys()])) {
    const delta =
      (next.clubs.byId[id]?.balance.cents ?? 0) - (previous.clubs.byId[id]?.balance.cents ?? 0);
    const gross = delta + (paid.get(id) ?? 0) - (bookedIncome.get(id) ?? 0);
    const row = get(id, financialMonth(next.lastProcessedAt));
    row.income += Math.max(0, gross);
    row.expenses += Math.max(0, -gross);
  }
  return {
    ...next,
    management: {
      ...next.management,
      financialHistory: rows,
      historyStartedAtRevision:
        previous.management?.historyStartedAtRevision ?? previous.revision + 1,
    },
  };
}
export function monthlyFinancialReport(
  state: WorldState,
  clubId: string,
  ledger: readonly Pick<GameEvent, 'sequence' | 'occurredAt' | 'balances'>[],
) {
  const rows = new Map<
    string,
    { month: string; income: number; expenses: number; fixedCosts: number; profit: number }
  >();
  const get = (month: string) => {
    let row = rows.get(month);
    if (!row) {
      row = { month, income: 0, expenses: 0, fixedCosts: 0, profit: 0 };
      rows.set(month, row);
    }
    return row;
  };
  for (const entry of ledger) {
    if (
      state.management?.historyStartedAtRevision !== undefined &&
      entry.sequence >= state.management.historyStartedAtRevision
    )
      continue;
    const change = entry.balances?.[clubId] ?? 0;
    if (!change) continue;
    const row = get(financialMonth(entry.occurredAt));
    row.income += Math.max(0, change);
    row.expenses += Math.max(0, -change);
  }
  for (const item of state.management?.financialHistory ?? [])
    if (item.clubId === clubId) {
      const row = get(item.month);
      row.income += item.income;
      row.expenses += item.expenses;
      row.fixedCosts += item.fixedCosts;
    }
  const first = financialMonth(state.createdAt),
    last = financialMonth(Math.max(state.createdAt, state.lastProcessedAt));
  const start = new Date(first + '-01T12:00:00Z'),
    end = new Date(last + '-01T12:00:00Z');
  for (
    let date = start;
    date <= end;
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12))
  )
    get(date.toISOString().slice(0, 7));
  const months = [...rows.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({ ...row, profit: row.income - row.expenses }));
  const income = months.reduce((sum, r) => sum + r.income, 0),
    expenses = months.reduce((sum, r) => sum + r.expenses, 0);
  const completedMonths = months.filter((row) => row.month < last);
  const previousDate = new Date(end);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  return {
    months,
    income,
    expenses,
    averageProfit: completedMonths.length
      ? completedMonths.reduce((sum, row) => sum + row.profit, 0) / completedMonths.length
      : 0,
    previous: months.find((row) => row.month === previousMonth),
    current: months.find((row) => row.month === last)!,
    legacy: ledger.some(
      (e) =>
        e.sequence < (state.management?.historyStartedAtRevision ?? Infinity) &&
        Boolean(e.balances?.[clubId]),
    ),
  };
}
export function seasonFinancialReport(
  state: WorldState,
  clubId: string,
  ledger: readonly Pick<GameEvent, 'sequence' | 'occurredAt' | 'balances' | 'type'>[],
) {
  const start = ledger.filter((e) => e.type === 'season.started').at(-1)?.sequence ?? 0;
  let income = 0,
    expenses = 0;
  for (const row of state.management?.financialHistory ?? [])
    if (row.clubId === clubId && (row.season ?? state.season) === state.season) {
      income += row.income;
      expenses += row.expenses;
    }
  for (const row of ledger) {
    if (
      row.sequence < start ||
      row.sequence >= (state.management?.historyStartedAtRevision ?? Infinity)
    )
      continue;
    const amount = row.balances?.[clubId] ?? 0;
    income += Math.max(0, amount);
    expenses += Math.max(0, -amount);
  }
  return { income, expenses, profit: income - expenses };
}
