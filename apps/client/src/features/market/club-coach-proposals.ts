import type { WorldState } from '@football/shared';
import { pendingCoachOffers } from '@football/domain';
export function clubCoachProposals(state: WorldState, clubId: string) {
  const member = state.participants.find((p) => p.clubId === clubId);
  if (!member) return [];
  return pendingCoachOffers(state, member.userId)
    .map((o) => ({ id: o.id, team: state.clubs.byId[o.clubId] }))
    .filter((o) => !!o.team);
}
