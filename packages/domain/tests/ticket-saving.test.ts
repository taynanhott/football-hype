import { describe, expect, it } from 'vitest';
import { commandSchema, worldStateSchema } from '@football/shared';
import { createWorld, executeCommand, applyEvent, TICKET_TIERS, stableId } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

describe('salvar as faixas atuais de ingresso', () => {
  it.each(TICKET_TIERS)('salva $label sem reescalar o valor no comando ou no estado', (tier) => {
    let state = unwrap(
      createWorld({
        id: IDS.league,
        userId: IDS.user,
        name: 'Ingressos',
        mode: 'offline',
        now: Date.parse('2026-01-15T15:00:00Z'),
      }),
    );
    const clubId = state.participants[0]!.clubId;
    const fixture = state.fixtures.find((game) => game.homeId === clubId && !game.neutral)!;
    for (const command of [
      { type: 'home-ticket-price', priceCents: tier.priceCents },
      { type: 'ticket-price', fixtureId: fixture.id, priceCents: tier.priceCents },
    ]) {
      const parsed = commandSchema.parse(command);
      expect(parsed).toMatchObject({ priceCents: tier.priceCents });
      state = unwrap(
        applyEvent(
          state,
          unwrap(
            executeCommand(
              state,
              parsed,
              IDS.user,
              state.lastProcessedAt,
              stableId(98, state.revision + 1),
            ),
          ),
        ),
      );
      expect(worldStateSchema.parse(state).homeTicketPrices?.[clubId]).toBe(tier.priceCents);
    }
    expect(worldStateSchema.parse(state).ticketPrices?.[fixture.id]).toBe(tier.priceCents);
  });
  it('rejeita preços inválidos antes de salvar', () => {
    for (const priceCents of [0, -50, 49, 50.5, 50000001]) {
      expect(commandSchema.safeParse({ type: 'home-ticket-price', priceCents }).success).toBe(
        false,
      );
    }
  });
});
