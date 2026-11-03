import { describe, expect, it } from 'vitest';
import {
  MONEY_STEPS,
  formatMoney,
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
  it('formata moeda compacta sem casas decimais e arredonda para cima', () => {
    expect(formatMoney(123456000)).toBe('HC$ 2K');
    expect(formatMoney(0)).toBe('HC$ 0');
    expect(formatMoney(12300000)).toBe('HC$ 123');
    expect(formatMoney(12340000)).toBe('HC$ 124');
    expect(formatMoney(-12300000)).toBe('HC$ -123');
  });
  it('exibe valores abaixo de mil sem o sufixo K', () => {
    expect(formatMoney(50000)).toBe('HC$ 1');
    expect(formatMoney(10000)).toBe('HC$ 1');
    expect(formatMoney(99999)).toBe('HC$ 1');
    expect(formatMoney(-50000)).toBe('HC$ 0');
    expect(formatMoney(100000)).toBe('HC$ 1');
    expect(formatMoney(-100000)).toBe('HC$ -1');
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
    ).toBe(123460000);
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
    expect(commandSchema.parse({ type: 'home-ticket-price', priceCents: 10000000 })).toMatchObject({
      priceCents: 10000000,
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
      expect(club.balance.cents % MONEY_STEPS.general).toBe(0);
    const ownId = state.participants[0]!.clubId;
    const event = unwrap(
      executeCommand(
        state,
        { type: 'home-ticket-price', priceCents: 10000000 },
        IDS.user,
        now,
        stableId(18, 1),
      ),
    );
    const next = unwrap(applyEvent(state, event));
    expect(next.homeTicketPrices?.[ownId]).toBe(10000000);
    const fixture = scheduledFixtures(next).find((item) => item.homeId === ownId)!;
    const demand = matchDemand(next, fixture);
    expect(demand.priceCents).toBe(10000000);
    expect(demand.ticketRevenue % MONEY_STEPS.general).toBe(0);
    expect(demand.consumptionRevenue % MONEY_STEPS.general).toBe(0);
    expect(demand.selloutPriceCents % MONEY_STEPS.ticket).toBe(0);
    expect(demand.minimumCrowdPriceCents % MONEY_STEPS.ticket).toBe(0);
  });
});
