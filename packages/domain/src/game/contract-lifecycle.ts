import type { WorldState } from '@football/shared';
import { contractExpires, refusesForPlayingTime } from './player-contracts.js';
import { replenishMinimumSquad } from './minimum-squad.js';

/** Keep historical statistics and permanent development when a player changes clubs. */
export function resetTransferredEffects(previous: WorldState, next: WorldState): WorldState {
  if (previous.players === next.players) return next;
  const moved = next.players.ids.filter(
    (id) =>
      previous.players.byId[id] &&
      previous.players.byId[id]!.clubId !== next.players.byId[id]!.clubId,
  );
  if (!moved.length) return next;
  const players = { ...next.players.byId };
  const workload = { ...next.workload };
  const contractHistory = { ...next.management?.contractHistory };
  const centers = { ...next.centers.byId };
  for (const id of moved) {
    const player = players[id]!;
    players[id] = { ...player, morale: 70 };
    delete workload[id];
    contractHistory[id] = {
      overall: player.overall,
      marketValue: player.marketValue.cents,
      signedAt: next.lastProcessedAt,
      dissatisfied: false,
      valuedGames: 0,
      effectsClubGames: next.results.filter(
        (game) => game.homeId === player.clubId || game.awayId === player.clubId,
      ).length,
      effectsRatingCount: next.ratingHistory.filter((rating) => rating.playerId === id).length,
    };
    for (const center of Object.values(centers)) {
      if (!center.operations) continue;
      const ops = center.operations;
      const cycleBonuses = { ...ops.cycleBonuses };
      const effort = { ...ops.effort };
      const progression = { ...ops.progression };
      delete cycleBonuses[id];
      delete effort[id];
      if (progression[id]) progression[id] = { ...progression[id]!, buff: 0 };
      centers[center.id] = {
        ...center,
        operations: {
          ...ops,
          cycleBonuses,
          effort,
          progression,
          individual: ops.individual.filter((plan) => plan.playerId !== id),
        },
      };
    }
  }
  return {
    ...next,
    players: { ...next.players, byId: players },
    workload,
    centers: { ...next.centers, byId: centers },
    management: { ...next.management, contractHistory },
  };
}

/** Only players who decided to leave are released automatically. */
export function settleContractDecisions(state: WorldState): WorldState {
  let next = state;
  for (const id of state.players.ids) {
    const player = next.players.byId[id]!;
    if (!player.clubId || next.management?.loans?.[id]) continue;
    const record = next.management?.contractHistory?.[id];
    if (!record) continue;
    const remaining = contractExpires(next, player) - next.lastProcessedAt;
    const refuses =
      record.refusesRenewal ||
      (remaining <= 180 * 86400000 &&
        (record.severeDissatisfaction || refusesForPlayingTime(next, player)));
    if (!refuses) continue;
    if (!record.refusesRenewal)
      next = {
        ...next,
        management: {
          ...next.management,
          contractHistory: {
            ...next.management?.contractHistory,
            [id]: { ...record, refusesRenewal: true },
          },
        },
        players: {
          ...next.players,
          byId: {
            ...next.players.byId,
            [id]: { ...player, morale: Math.max(0, player.morale - 10) },
          },
        },
      };
    if (remaining > 0) continue;
    const club = next.clubs.byId[player.clubId]!;
    const tactics = { ...next.tactics };
    // An incomplete starting XI must be rebuilt by the existing lineup resolver.
    if (tactics[club.id]?.starters.includes(id)) delete tactics[club.id];
    else if (tactics[club.id])
      tactics[club.id] = {
        ...tactics[club.id]!,
        bench: tactics[club.id]!.bench?.filter((member) => member !== id),
      };
    next = {
      ...next,
      tactics,
      players: {
        ...next.players,
        byId: { ...next.players.byId, [id]: { ...player, clubId: null } },
      },
      clubs: {
        ...next.clubs,
        byId: {
          ...next.clubs.byId,
          [club.id]: { ...club, playerIds: club.playerIds.filter((member) => member !== id) },
        },
      },
    };
    next = replenishMinimumSquad(next, club.id, player);
  }
  return resetTransferredEffects(state, next);
}
