import { formatMoney, formatMoneyFull } from '@football/shared';
export const currency = formatMoney;
export const shortMoney = (cents: number) => {
  const amount = Math.ceil(cents / 100);
  const absolute = Math.abs(amount);
  const unit =
    absolute >= 1_000_000_000
      ? 1_000_000_000
      : absolute >= 1_000_000
        ? 1_000_000
        : absolute > 1_000
          ? 1_000
          : 1;
  const suffix =
    unit === 1_000_000_000 ? ' B' : unit === 1_000_000 ? ' M' : unit === 1_000 ? ' K' : '';
  return 'HC$ ' + (amount / unit).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + suffix;
};
export const compactMoney = formatMoney;
export const ticketPrice = formatMoney;
export const dateTime = (time: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(time);

export const marketValue = formatMoney;

export const transferMoney = formatMoneyFull;
