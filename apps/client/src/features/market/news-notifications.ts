import { coachNews } from './coach-news';
import { awardNews } from './award-news';
import type { WorldState, Negotiation } from '@football/shared';
import { uniqueTransferStories, transferStoryKey } from './transfer-stories';
import { roundNews } from './round-news';

export function listedNewsOffers(state: WorldState): Negotiation[] {
  const clubs = new Set(state.participants.map((p) => p.clubId));
  return uniqueTransferStories(
    [
      ...state.negotiations,
      ...(state.management?.offers ?? []).map((o) => ({
        ...o,
        offeredSalary: o.salary,
        interest: 0,
        status:
          o.status === 'pending'
            ? ('review' as const)
            : o.status === 'accepted'
              ? ('completed' as const)
              : ('rejected' as const),
      })),
    ]
      .filter((o) => clubs.has(o.buyerId) || (o.sellerId !== undefined && clubs.has(o.sellerId)))
      .sort((a, b) => (a.offeredAt ?? 0) - (b.offeredAt ?? 0)),
  );
}
export function ownNewsKeys(state: WorldState, clubId: string) {
  const name = state.clubs.byId[clubId]?.name;
  return [
    ...coachNews(state)
      .filter((n) => n.homeId === clubId || n.awayId === clubId)
      .map((n) => n.id),
    ...awardNews(state)
      .filter((n) => n.homeId === clubId)
      .map((n) => n.id),
    ...listedNewsOffers(state)
      .slice(-20)
      .filter((o) => o.buyerId === clubId || o.sellerId === clubId)
      .map(transferStoryKey),
    ...roundNews(state)
      .filter((n) => name && (n.title + ' ' + n.body).includes(name))
      .map((n) => n.id),
  ];
}
const event = 'football-news-seen';
const memory = new Map<string, Set<string>>();
function storageKey(state: WorldState, clubId: string, userId: string) {
  return `football:news-seen:${userId}:${state.id}:${clubId}`;
}
function read(key: string): Set<string> {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    const seen = new Set(
      Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
    );
    memory.set(key, seen);
    return seen;
  } catch {
    const seen = new Set<string>();
    memory.set(key, seen);
    return seen;
  }
}
export function hasUnreadClubNews(state: WorldState, clubId: string, userId: string) {
  const seen = read(storageKey(state, clubId, userId));
  return ownNewsKeys(state, clubId).some((id) => !seen.has(id));
}
export function markClubNewsSeen(state: WorldState, clubId: string, userId: string, id: string) {
  const key = storageKey(state, clubId, userId);
  const seen = read(key);
  if (seen.has(id)) return;
  seen.add(id);
  // Retain only stories still present in the feed.
  const current = new Set(ownNewsKeys(state, clubId));
  const retained = new Set([...seen].filter((item) => current.has(item)));
  memory.set(key, retained);
  try {
    localStorage.setItem(key, JSON.stringify([...retained]));
  } catch {
    /* Keep session state. */
  }
  window.dispatchEvent(new Event(event));
}
export const newsSeenEvent = event;
