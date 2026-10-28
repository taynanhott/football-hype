/** Monetary steps in cents: R$ 1,000 generally, R$ 25 tickets, R$ 5 salaries. */
export const MONEY_STEPS = Object.freeze({ general: 100000, ticket: 2500, salary: 500 });
export function roundMoney(cents: number, step: number = MONEY_STEPS.general): number {
  const limit = Math.floor(Number.MAX_SAFE_INTEGER / step) * step;
  return Math.max(-limit, Math.min(limit, Math.round(cents / step) * step));
}
export function ceilMoney(cents: number, step: number = MONEY_STEPS.general): number {
  return Math.ceil(cents / step) * step;
}
