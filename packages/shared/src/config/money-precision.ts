/** All economic amounts use one tenth of K (R$ 100). */
export const MONEY_STEPS = Object.freeze({ general: 10000, ticket: 10000, salary: 10000 });
export function roundMoney(cents: number, step: number = MONEY_STEPS.general): number {
  const limit = Math.floor(Number.MAX_SAFE_INTEGER / step) * step;
  return Math.max(-limit, Math.min(limit, Math.round(cents / step) * step));
}
export function ceilMoney(cents: number, step: number = MONEY_STEPS.general): number {
  return Math.ceil(cents / step) * step;
}

export function formatMoney(cents: number): string {
  if (Math.abs(cents) < 100000) {
    return (cents / 100).toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
    });
  }
  return `${(cents / 100000).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} K`;
}
