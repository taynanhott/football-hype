import { describe, expect, it } from 'vitest';
import {
  createWorld,
  stableId,
  executeCommand,
  transferContext,
  generateIncomingOffers,
} from '../src/index.js';
import { settleContractDecisions } from '../src/game/contract-lifecycle.js';
import { prepareAcademy } from '../src/game/academy.js';
import { averageMonthlySalary } from '../src/game/player-contracts.js';
import { worldStateSchema, type WorldState } from '@football/shared';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
function setup() {
  const state = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Mínimo', mode: 'offline', now }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const playerIds = club.playerIds.slice(0, 18);
  const next = {
    ...state,
    lastProcessedAt: now,
    clubs: { ...state.clubs, byId: { ...state.clubs.byId, [club.id]: { ...club, playerIds } } },
    players: {
      ...state.players,
      byId: Object.fromEntries(
        Object.entries(state.players.byId).map(([id, player]) => [
          id,
          player.clubId === club.id && !playerIds.includes(id)
            ? { ...player, clubId: null }
            : player,
        ]),
      ),
    },
  };
  return {
    state: next,
    club: next.clubs.byId[club.id]!,
    player: next.players.byId[playerIds[0]!]!,
  };
}
function expiry(state: WorldState, id: string) {
  const player = state.players.byId[id]!;
  return {
    ...state,
    management: {
      ...state.management,
      contracts: { ...state.management?.contracts, [id]: now },
      contractHistory: {
        ...state.management?.contractHistory,
        [id]: {
          overall: player.overall,
          marketValue: player.marketValue.cents,
          signedAt: now - 365 * 86400000,
          dissatisfied: false,
          refusesRenewal: true,
        },
      },
    },
  };
}
describe('elenco mínimo de 18', () => {
  it('permite interesse com 19 e não promove desnecessariamente quando a saída deixa 18', () => {
    const { state, club, player } = setup();
    const extra = Object.values(state.players.byId).find((p) => p.clubId === null)!;
    const larger = {
      ...state,
      players: {
        ...state.players,
        byId: { ...state.players.byId, [extra.id]: { ...extra, clubId: club.id } },
      },
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, playerIds: [...club.playerIds, extra.id] },
        },
      },
      management: {
        ...state.management,
        policies: { [player.id]: { available: true, rivals: true, interest: 100 } },
      },
    };
    const buyer = Object.values(state.clubs.byId).find((candidate) => candidate.id !== club.id)!;
    expect(transferContext(larger, player, buyer).clubInterest).toBeGreaterThan(0);
    const next = settleContractDecisions(expiry(larger, player.id));
    expect(next.clubs.byId[club.id]!.playerIds).toHaveLength(18);
    expect(next.players.ids).toEqual(larger.players.ids);
    expect(next.clubs.byId[club.id]!.balance).toEqual(club.balance);
  });
  it('bloqueia novas propostas e a conclusão de uma negociação pendente', () => {
    const { state, club: seller, player } = setup();
    const buyer = Object.values(state.clubs.byId).find((club) => club.id !== seller.id)!;
    expect(transferContext(state, player, buyer).clubInterest).toBe(0);
    expect(generateIncomingOffers(state).management?.offers ?? []).toEqual([]);
    const buying = { ...state, participants: [{ ...state.participants[0]!, clubId: buyer.id }] };
    const rejected = executeCommand(
      buying,
      { type: 'offer', playerId: player.id, fee: 0 },
      IDS.user,
      now,
      IDS.player,
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.message).toContain('18 jogadores');
    const pending = {
      ...buying,
      negotiations: [
        {
          id: IDS.player,
          playerId: player.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          fee: 0,
          offeredSalary: null,
          interest: 100,
          status: 'salary' as const,
        },
      ],
    };
    const salary = executeCommand(
      pending,
      { type: 'salary', negotiationId: IDS.player, salary: 1000000 },
      IDS.user,
      now,
      IDS.secondPlayer,
    );
    expect(salary.ok).toBe(false);
    if (!salary.ok) expect(salary.error.message).toContain('18 jogadores');
  });
  it('repõe duas saídas pela base, cobra salários e não duplica promoções', () => {
    const { state, club, player } = setup();
    const prepared = prepareAcademy(state, club.id);
    const next = settleContractDecisions(expiry(expiry(prepared, player.id), club.playerIds[1]!));
    const promoted = next.clubs.byId[club.id]!.playerIds.filter(
      (id) => !club.playerIds.includes(id),
    );
    expect(next.clubs.byId[club.id]!.playerIds).toHaveLength(18);
    expect(promoted).toHaveLength(2);
    expect(promoted.every((id) => prepared.players.byId[id]?.academyClubId === club.id)).toBe(true);
    const wages = promoted.reduce(
      (sum, id) =>
        sum + averageMonthlySalary(next.players.byId[id]!.overall, next.players.byId[id]!.age),
      0,
    );
    expect(next.clubs.byId[club.id]!.balance.cents).toBe(Math.max(0, club.balance.cents - wages));
    expect(settleContractDecisions(next)).toEqual(next);
    expect(worldStateSchema.safeParse(next).success).toBe(true);
  });
  it('gera um jovem 17/45/50 quando esgota a base e registra salário como dívida sem caixa', () => {
    const { state, club, player } = setup();
    const exhausted = Array.from({ length: 8 }, (_, index) => ({
      ...player,
      id: stableId(97, index),
      clubId: null,
      academyClubId: club.id,
      academySeason: state.season,
      academyDismissedSeason: state.season,
    }));
    const empty = {
      ...state,
      players: {
        ids: [...state.players.ids, ...exhausted.map((p) => p.id)],
        byId: { ...state.players.byId, ...Object.fromEntries(exhausted.map((p) => [p.id, p])) },
      },
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, balance: { ...club.balance, cents: 0 } },
        },
      },
    };
    const next = settleContractDecisions(expiry(empty, player.id));
    const id = next.clubs.byId[club.id]!.playerIds.find((id) => !club.playerIds.includes(id))!;
    expect(next.players.byId[id]).toMatchObject({
      age: 17,
      overall: 45,
      potential: 50,
      clubId: club.id,
      appearances: 0,
      academyPromotedSeason: state.season,
    });
    expect(next.players.byId[id]!.marketValue.cents).toBeGreaterThan(0);
    expect(next.debts[club.id]).toBe((state.debts[club.id] ?? 0) + averageMonthlySalary(45, 17));
    expect(next.clubs.byId[club.id]!.playerIds).toHaveLength(18);
    expect(worldStateSchema.safeParse(next).success).toBe(true);
    expect(settleContractDecisions(next)).toEqual(next);
  });
});
