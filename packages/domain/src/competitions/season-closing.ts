/** Recovery applies to matches; administrative events use shorter intervals. */
export const SEASON_EVENT_GAP_MS = 7 * 86400000;
const DAY = 86400000;
export function seasonClosingDates(lastMatchAt: number) {
  return {
    lastMatchAt,
    paymentAt: lastMatchAt + 2 * DAY,
    galaAt: lastMatchAt + 4 * DAY,
    endAt: lastMatchAt + 5 * DAY,
  };
}

/** Adjust only upcoming milestones; paid prizes and presented awards keep their dates. */
export function pendingSeasonClosingDates(
  closing: ReturnType<typeof seasonClosingDates> & { stage: 'payments' | 'gala' | 'end' },
) {
  const dates = seasonClosingDates(closing.lastMatchAt);
  if (closing.stage === 'payments') return { ...closing, ...dates };
  if (closing.stage === 'gala')
    return { ...closing, galaAt: closing.paymentAt + 2 * DAY, endAt: closing.paymentAt + 3 * DAY };
  return { ...closing, endAt: closing.galaAt + DAY };
}
