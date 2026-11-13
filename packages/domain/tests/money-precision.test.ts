import { describe, expect, it } from 'vitest';
import {
  MONEY_STEPS,
  formatMoney,
  roundMoney,
  playerSchema,
  clubSchema,
  commandSchema,
  GAMEPLAY,
  gameEventSchema,
  matchResultSchema,
} from '@football/shared';
import {
  createWorld,
  executeCommand,
  applyEvent,
  matchDemand,
  scheduledFixtures,
  stableId,
} from '../src/index.js';
import { IDS, unwrap, playerInput, clubInput } from '../../../tests/fixtures/domain.js';

describe('precisão monetária do jogo', () => {
  it('preserva os centavos de saldos, bilheteria e movimentos ao validar dados persistidos', () => {
    const club = clubSchema.parse(clubInput({ balance: { cents: 123456789, currency: 'BRL' } }));
    const result = matchResultSchema.parse({
      fixtureId: 'precision',
      homeGoals: 0,
      awayGoals: 0,
      attendance: 101,
      revenue: 5050,
      seed: 1,
      scorers: [],
    });
    const event = gameEventSchema.parse({
      id: IDS.player,
      sequence: 1,
      occurredAt: 1,
      actorId: IDS.user,
      type: 'round.played',
      message: 'Bilheteria',
      amount: 5050,
      balances: { [club.id]: 3535, [IDS.secondClub]: 1515 },
      patch: {
        results: [result],
        debts: { [club.id]: 5035 },
        management: {
          wageDebts: { [club.id]: 1515 },
          charges: [
            { clubId: club.id, month: '2026-01', wages: 1515, maintenance: 10000, unpaid: 5035 },
          ],
          financialHistory: [
            { clubId: club.id, month: '2026-01', income: 5050, expenses: 1515, fixedCosts: 11515 },
          ],
        },
      },
    });
    expect(club.balance.cents).toBe(123456789);
    expect(result.revenue).toBe(5050);
    expect(event.amount).toBe(5050);
    expect(event.balances![club.id]! + event.balances![IDS.secondClub]!).toBe(result.revenue);
    expect(event.patch.debts?.[club.id]).toBe(5035);
    expect(event.patch.management?.wageDebts?.[club.id]).toBe(1515);
    expect(event.patch.management?.charges?.[0]!.unpaid).toBe(5035);
    expect(event.patch.management?.financialHistory?.[0]!.fixedCosts).toBe(11515);
    expect(gameEventSchema.parse(event)).toEqual(event);
  });
  it('formata centavos em HC$ inteiros sem abreviação', () => {
    expect(formatMoney(123456000)).toBe('HC$ 1.234.560');
    expect(formatMoney(0)).toBe('HC$ 0');
    expect(formatMoney(12300000)).toBe('HC$ 123.000');
    expect(formatMoney(12340000)).toBe('HC$ 123.400');
    expect(formatMoney(-12300000)).toBe('HC$ -123.000');
  });
  it('exibe valores abaixo de mil sem o sufixo K', () => {
    expect(formatMoney(50000)).toBe('HC$ 500');
    expect(formatMoney(10000)).toBe('HC$ 100');
    expect(formatMoney(99999)).toBe('HC$ 1.000');
    expect(formatMoney(-50000)).toBe('HC$ -500');
    expect(formatMoney(100000)).toBe('HC$ 1.000');
    expect(formatMoney(-100000)).toBe('HC$ -1.000');
  });
  it('normaliza cadastros existentes por categoria sem manter centavos', () => {
    const player = playerSchema.parse(
      playerInput({
        salary: { cents: 123456, currency: 'BRL' },
        marketValue: { cents: 12345678, currency: 'BRL' },
      }),
    );
    expect(player.salary.cents).toBe(125000);
    expect(player.marketValue.cents).toBe(12350000);
    expect(
      clubSchema.parse(clubInput({ balance: { cents: 123456789, currency: 'BRL' } })).balance.cents,
    ).toBe(123456789);
    expect(roundMoney(145000)).toBe(150000);
    expect(roundMoney(158000)).toBe(160000);
  });
  it('normaliza propostas, salários e ingressos recebidos do cliente', () => {
    expect(
      commandSchema.parse({ type: 'offer', playerId: IDS.player, fee: 12345678 }),
    ).toMatchObject({ fee: 12350000 });
    expect(
      commandSchema.parse({ type: 'salary', negotiationId: IDS.player, salary: 123456 }),
    ).toMatchObject({ salary: 125000 });
    expect(commandSchema.parse({ type: 'home-ticket-price', priceCents: 100 })).toMatchObject({
      priceCents: 100,
    });
    expect(GAMEPLAY.baseTicketCents % MONEY_STEPS.ticket).toBe(0);
  });
  it('respeita a precisão monetária de cada categoria', () => {
    const now = Date.parse('2026-10-26T15:00:00Z');
    const state = unwrap(
      createWorld({ id: IDS.league, userId: IDS.user, name: 'Precisão', mode: 'offline', now }),
    );
    for (const player of Object.values(state.players.byId)) {
      expect(player.marketValue.cents % MONEY_STEPS.general).toBe(0);
      expect(player.salary.cents % MONEY_STEPS.salary).toBe(0);
    }
    for (const club of Object.values(state.clubs.byId))
      expect(Number.isSafeInteger(club.balance.cents)).toBe(true);
    const ownId = state.participants[0]!.clubId;
    const event = unwrap(
      executeCommand(
        state,
        { type: 'home-ticket-price', priceCents: 100 },
        IDS.user,
        now,
        stableId(18, 1),
      ),
    );
    const next = unwrap(applyEvent(state, event));
    expect(next.homeTicketPrices?.[ownId]).toBe(100);
    const fixture = scheduledFixtures(next).find((item) => item.homeId === ownId)!;
    const demand = matchDemand(next, fixture);
    expect(demand.priceCents).toBe(100);
    expect(demand.ticketRevenue).toBe(demand.attendance * demand.priceCents);
    expect(demand.consumptionRevenue % MONEY_STEPS.salary).toBe(0);
    expect(demand.selloutPriceCents % MONEY_STEPS.ticket).toBe(0);
    expect(demand.minimumCrowdPriceCents % MONEY_STEPS.ticket).toBe(0);
  });
});
