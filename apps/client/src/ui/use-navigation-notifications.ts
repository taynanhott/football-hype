import { useState } from 'react';
import type { WorldState } from '@football/shared';
import { renewalTerms } from '@football/domain';
import { clubUnavailablePlayers } from '../features/players/player-availability';

const empty = { renewal: false, unavailable: false, market: false };
export function useNavigationNotifications(
  world: WorldState | undefined,
  userId: string,
  locked: boolean,
) {
  const clubId = world?.participants.find((member) => member.userId === userId)?.clubId;
  const scope = `${world?.id ?? ''}:${clubId ?? ''}`;
  const [saved, setSaved] = useState({ scope, flags: empty });
  const club = world?.clubs.byId[clubId ?? ''];
  const flags = locked
    ? saved.scope === scope
      ? saved.flags
      : empty
    : world && club
      ? {
          renewal: club.playerIds.some((id) => {
            const player = world.players.byId[id];
            return Boolean(player && renewalTerms(world, player).demand);
          }),
          unavailable: clubUnavailablePlayers(world, club).length > 0,
          market: Boolean(
            world.management?.offers?.some(
              (offer) => offer.sellerId === club.id && offer.status === 'pending',
            ) ||
            world.negotiations.some(
              (offer) => offer.buyerId === club.id && offer.status === 'review',
            ),
          ),
        }
      : empty;
  if (
    saved.scope !== scope ||
    saved.flags.renewal !== flags.renewal ||
    saved.flags.unavailable !== flags.unavailable ||
    saved.flags.market !== flags.market
  ) {
    setSaved({ scope, flags });
  }
  return flags;
}
