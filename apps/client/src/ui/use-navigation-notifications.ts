import { clubCoachProposals } from '../features/market/club-coach-proposals';
import { useEffect, useMemo, useState } from 'react';
import type { WorldState } from '@football/shared';
import { renewalTerms } from '@football/domain';
import { clubUnavailablePlayers } from '../features/players/player-availability';
import { hasUnreadClubNews, newsSeenEvent } from '../features/market/news-notifications';

type Kind = 'renewal' | 'unavailable' | 'market' | 'pending';
const event = 'football-notifications-seen';
function signature(world: WorldState, clubId: string, kind: Kind) {
  const club = world.clubs.byId[clubId];
  if (!club) return '';
  if (kind === 'renewal')
    return JSON.stringify(
      club.playerIds.flatMap((id) => {
        const player = world.players.byId[id];
        const demand = player && renewalTerms(world, player).demand;
        return demand ? [[id, demand]] : [];
      }),
    );
  if (kind === 'unavailable')
    return JSON.stringify(
      clubUnavailablePlayers(world, club).map((p) => [
        p.id,
        world.injuries[p.id],
        Math.floor(world.lastProcessedAt / (86400000 * 14)),
      ]),
    );
  return JSON.stringify(
    kind === 'pending'
      ? world.negotiations.filter((o) => o.buyerId === clubId && o.status === 'review')
      : [
          ...(world.management?.offers ?? []).filter(
            (o) => o.sellerId === clubId && o.status === 'pending',
          ),
          ...world.negotiations.filter((o) => o.sellerId === clubId && o.status === 'review'),
          ...clubCoachProposals(world, clubId).map((o) => ['coach', o.id]),
        ],
  );
}
export function markNotificationsSeen(world: WorldState, clubId: string, kind: Kind) {
  try {
    localStorage.setItem(
      `football:seen:${world.id}:${clubId}:${kind}`,
      signature(world, clubId, kind),
    );
  } catch {
    /* Storage may be unavailable. */
  }
  window.dispatchEvent(new Event(event));
}
export function useNavigationNotifications(
  world: WorldState | undefined,
  userId: string,
  locked: boolean,
) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    window.addEventListener(event, update);
    window.addEventListener(newsSeenEvent, update);
    return () => {
      window.removeEventListener(event, update);
      window.removeEventListener(newsSeenEvent, update);
    };
  }, []);
  const clubId = world?.participants.find((member) => member.userId === userId)?.clubId;
  const signatures = useMemo(() => {
    const kinds: Kind[] = ['renewal', 'unavailable', 'market', 'pending'];
    return Object.fromEntries(
      kinds.map((kind) => [kind, world && clubId ? signature(world, clubId, kind) : '']),
    );
  }, [world, clubId]);
  const unread = (kind: Kind) => {
    if (!world || !clubId) return false;
    const value = signatures[kind];
    try {
      return (
        value !== '[]' &&
        value !== '' &&
        localStorage.getItem(`football:seen:${world.id}:${clubId}:${kind}`) !== value
      );
    } catch {
      return value !== '[]' && value !== '';
    }
  };
  const flags = {
    news: Boolean(world && clubId && hasUnreadClubNews(world, clubId, userId)),
    renewal: unread('renewal'),
    unavailable: unread('unavailable'),
    market: unread('market') || unread('pending') || unread('renewal'),
  };
  const [saved, setSaved] = useState(flags);
  if (!locked && JSON.stringify(saved) !== JSON.stringify(flags)) setSaved(flags);
  return locked ? saved : flags;
}
