import { formatMoney, formatMoneyFull } from '@football/shared';
export const currency = formatMoney;
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

export const marketValue = (cents: number) => {
  const amount = Math.ceil(cents / 100);
  const unit = Math.abs(amount) >= 1000000 ? 1000000 : Math.abs(amount) >= 1000 ? 1000 : 1;
  return (
    'HC$ ' +
    (amount / unit).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) +
    (unit === 1000000 ? 'M' : unit === 1000 ? 'K' : '')
  );
};

export const transferMoney = formatMoneyFull;
