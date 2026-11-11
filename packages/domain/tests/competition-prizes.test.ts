import { describe, it, expect } from 'vitest';
import { leaguePrize, settleCompetitionPrizes } from '../src/competitions/competition-prizes.js';
import { createWorld } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
const world = () =>
  unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Pagamentos',
      mode: 'offline',
      now: Date.parse('2026-10-26T15:00:00Z'),
    }),
  );
describe('premiações dos campeonatos', () => {
  it('respeita tabelas e arredonda D em centenas', () => {
    expect(leaguePrize('B', 0)).toBe(15000);
    expect(leaguePrize('B', 19)).toBe(2000);
    expect(leaguePrize('C', 0)).toBe(7000);
    expect(leaguePrize('C', 19)).toBe(1300);
    expect(leaguePrize('A', 0)).toBe(30000);
    expect(leaguePrize('D', 19)).toBe(700);
  });
  it('não paga antes da última partida', () => {
    const s = world();
    expect(settleCompetitionPrizes(s)).toBe(s);
  });
  it('credita o campeão da copa uma só vez com registro persistido', () => {
    const s = world();
    const clubId = s.clubs.ids[0]!;
    const node = {
      id: 'copa-brasil:final',
      competitionId: 'copa-brasil',
      round: 4,
      homeId: clubId,
      awayId: s.clubs.ids[1]!,
      leftId: null,
      rightId: null,
      winnerId: clubId,
      scheduledAt: s.lastProcessedAt,
      legs: 1,
    };
    const state = {
      ...s,
      fixtures: [],
      cups: [node],
      results: [
        {
          fixtureId: node.id,
          status: 'finished',
          homeGoals: 1,
          awayGoals: 0,
          attendance: 0,
          revenue: 0,
          seed: 1,
          scorers: [],
        },
      ],
    };
    const paid = settleCompetitionPrizes(state);
    expect(paid.clubs.byId[clubId]!.balance.cents - state.clubs.byId[clubId]!.balance.cents).toBe(
      3000000,
    );
    expect(paid.competitionPayments).toHaveLength(1);
    expect(settleCompetitionPrizes(paid)).toBe(paid);
  });
});
