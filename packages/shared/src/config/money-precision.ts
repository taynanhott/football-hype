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

export function formatMoney(cents: number): string {
  const amount = Math.ceil(cents / 100000) || 0;
  if (Math.abs(amount) < 1000) return 'HC$ ' + amount.toLocaleString('pt-BR');
  const unit = Math.abs(amount) >= 1000000 ? 1000000 : 1000;
  return 'HC$ ' + Math.ceil(amount / unit).toLocaleString('pt-BR') + (unit === 1000000 ? 'M' : 'K');
}
export function formatMoneyFull(cents: number): string {
  return 'HC$ ' + Math.ceil(cents / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
