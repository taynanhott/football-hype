import { describe, expect, it } from 'vitest';
import {
  MONEY_STEPS,
  roundMoney,
  playerSchema,
  clubSchema,
  commandSchema,
  GAMEPLAY,
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
  it('normaliza cadastros existentes por categoria sem manter centavos', () => {
    const player = playerSchema.parse(
      playerInput({
        salary: { cents: 123456, currency: 'BRL' },
        marketValue: { cents: 12345678, currency: 'BRL' },
      }),
    );
    expect(player.salary.cents).toBe(123500);
    expect(player.marketValue.cents).toBe(12300000);
    expect(
      clubSchema.parse(clubInput({ balance: { cents: 123456789, currency: 'BRL' } })).balance.cents,
    ).toBe(123500000);
    expect(roundMoney(145000)).toBe(100000);
    expect(roundMoney(158000)).toBe(200000);
  });
  it('normaliza propostas, salários e ingressos recebidos do cliente', () => {
    expect(
      commandSchema.parse({ type: 'offer', playerId: IDS.player, fee: 12345678 }),
    ).toMatchObject({ fee: 12300000 });
    expect(
      commandSchema.parse({ type: 'salary', negotiationId: IDS.player, salary: 123456 }),
    ).toMatchObject({ salary: 123500 });
    expect(commandSchema.parse({ type: 'home-ticket-price', priceCents: 8345 })).toMatchObject({
      priceCents: 7500,
    });
    expect(GAMEPLAY.baseTicketCents % MONEY_STEPS.ticket).toBe(0);
  });
  it('gera valores de mercado e saldos em milhares, salários em cinco e ingressos em vinte e cinco', () => {
    const now = Date.parse('2026-10-26T15:00:00Z');
    const state = unwrap(
      createWorld({ id: IDS.league, userId: IDS.user, name: 'Precisão', mode: 'offline', now }),
    );
    for (const player of Object.values(state.players.byId)) {
      expect(player.marketValue.cents % MONEY_STEPS.general).toBe(0);
      expect(player.salary.cents % MONEY_STEPS.salary).toBe(0);
    }
    for (const club of Object.values(state.clubs.byId))
      expect(club.balance.cents % MONEY_STEPS.general).toBe(0);
    const ownId = state.participants[0]!.clubId;
    const event = unwrap(
      executeCommand(
        state,
        { type: 'home-ticket-price', priceCents: 8345 },
        IDS.user,
        now,
        stableId(18, 1),
      ),
    );
    const next = unwrap(applyEvent(state, event));
    expect(next.homeTicketPrices?.[ownId]).toBe(7500);
    const fixture = scheduledFixtures(next).find((item) => item.homeId === ownId)!;
    const demand = matchDemand(next, fixture);
    expect(demand.priceCents).toBe(7500);
    expect(demand.ticketRevenue % MONEY_STEPS.general).toBe(0);
    expect(demand.consumptionRevenue % MONEY_STEPS.general).toBe(0);
    expect(demand.selloutPriceCents % MONEY_STEPS.ticket).toBe(0);
    expect(demand.minimumCrowdPriceCents % MONEY_STEPS.ticket).toBe(0);
  });
});
