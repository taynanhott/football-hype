import type { Negotiation } from '@football/shared';

export const transferStoryKey = (offer: Negotiation) =>
  JSON.stringify([offer.playerId, offer.buyerId, offer.sellerId ?? null]);

/** A negotiation's latest state updates its existing story instead of creating another post. */
export function uniqueTransferStories(offers: readonly Negotiation[]): Negotiation[] {
  const stories = new Map<string, Negotiation>();
  const rank = { review: 0, salary: 1, rejected: 2, completed: 3 };
  for (const offer of offers) {
    const key = transferStoryKey(offer);
    const previous = stories.get(key);
    if (
      !previous ||
      (offer.offeredAt ?? 0) > (previous.offeredAt ?? 0) ||
      ((offer.offeredAt ?? 0) === (previous.offeredAt ?? 0) &&
        rank[offer.status] >= rank[previous.status])
    )
      stories.set(key, offer);
  }
  return [...stories.values()].sort((a, b) => (a.offeredAt ?? 0) - (b.offeredAt ?? 0));
}
