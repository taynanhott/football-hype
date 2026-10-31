import { formatMoney } from '@football/shared';
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
