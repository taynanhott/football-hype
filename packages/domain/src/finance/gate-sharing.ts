/** Split paid admission only; commerce stays with the home club. Preserve every cent. */
export function shareMatchRevenue(ticketRevenue: number, totalRevenue: number) {
  const away = Math.floor(ticketRevenue * 0.3);
  return { home: totalRevenue - away, away };
}
