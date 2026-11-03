/** Amounts are stored in cents; each control has an explicit precision. */
export const MONEY_STEPS = Object.freeze({
  general: 10000,
  ticket: 5000000,
  salary: 5000,
  transfer: 50000,
  transferSlider: 100000000,
});
export function roundMoney(cents: number, step: number = MONEY_STEPS.general): number {
  const limit = Math.floor(Number.MAX_SAFE_INTEGER / step) * step;
  return Math.max(-limit, Math.min(limit, Math.round(cents / step) * step));
}
export function ceilMoney(cents: number, step: number = MONEY_STEPS.general): number {
  return Math.ceil(cents / step) * step;
}

/** Display the stored cents as whole currency units, without scaling or abbreviations. */
export function formatMoney(cents: number): string {
  return 'HC$ ' + Math.ceil(cents / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
export const formatMoneyFull = formatMoney;
