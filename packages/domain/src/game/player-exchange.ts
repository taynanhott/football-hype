import { roundMoney, type WorldState } from '@football/shared';
export function exchangeCandidates(state: WorldState, buyerId: string, sellerId: string) {
  const buyer = state.clubs.byId[buyerId],
    seller = state.clubs.byId[sellerId];
  if (!buyer || !seller || buyerId === sellerId) return [];
  const human = state.participants.some((p) => p.clubId === sellerId);
  return buyer.playerIds.flatMap((id) => {
    const player = state.players.byId[id];
    if (!player || player.clubId !== buyerId || state.management?.loans?.[id]) return [];
    const peers = seller.playerIds.flatMap((pid) =>
      state.players.byId[pid]?.position === player.position ? [state.players.byId[pid]!] : [],
    );
    const interested =
      peers.length < 2 || player.overall >= Math.max(...peers.map((p) => p.overall)) - 2;
    return human || (interested && player.age <= 32)
      ? [{ player, value: roundMoney(player.marketValue.cents * 0.4) }]
      : [];
  });
}
