import { beforeEach, describe, expect, it } from 'vitest';
import { worldStateSchema, type WorldState, type GameCommand } from '@football/shared';
import {
  createWorld,
  applyEvent,
  executeCommand,
  stableId,
  advanceGameDays,
} from '../src/index.js';
import { loanTerms, loanWage, returnLoans, settleMonthly } from '../src/game/management.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
beforeEach(() => {
  state = unwrap(
    createWorld({
      id: stableId(991, 1),
      name: 'Empréstimos',
      mode: 'offline',
      userId: 'host',
      now,
    }),
  );
});
function act(command: GameCommand) {
  state = unwrap(
    applyEvent(
      state,
      unwrap(executeCommand(state, command, 'host', now, stableId(992, state.revision + 1))),
    ),
  );
}
function target() {
  const buyer = state.clubs.byId[state.participants[0]!.clubId]!;
  const seller = Object.values(state.clubs.byId).find((c) => c.id !== buyer.id)!;
  const original = state.players.byId[seller.playerIds.at(-1)!]!;
  const player = { ...original, overall: 40, potential: 42, age: 28, position: 'ST' as const };
  state = {
    ...state,
    players: { ...state.players, byId: { ...state.players.byId, [player.id]: player } },
  };
  state = {
    ...state,
    management: {
      ...state.management,
      contracts: { ...state.management?.contracts, [player.id]: now + 3 * 365 * 86400000 },
    },
  };
  return { buyer, seller, player };
}
describe('empréstimos', () => {
  it('não libera negociação bloqueada por empréstimo sem estar no mercado', () => {
    const { buyer, seller, player } = target();
    const weakBuyer = { ...buyer, leagueStrength: 0 };
    state.clubs = {
      ...state.clubs,
      byId: {
        ...state.clubs.byId,
        [buyer.id]: weakBuyer,
        [seller.id]: { ...seller, leagueStrength: 90 },
      },
    };
    for (const id of buyer.playerIds)
      state.players.byId[id] = { ...state.players.byId[id]!, overall: 30 };
    expect(loanTerms(state, player, weakBuyer).eligible).toBe(true);
    expect(loanTerms(state, player, weakBuyer).available).toBe(false);
    expect(
      executeCommand(
        state,
        {
          type: 'management',
          action: 'offer-loan',
          playerId: player.id,
          months: 6,
          salaryPercent: 100,
        },
        'host',
        now,
        stableId(995, 1),
      ).ok,
    ).toBe(false);
    state.management = {
      ...state.management,
      policies: {
        [player.id]: { available: true, loanAvailable: true, rivals: true, interest: 75 },
      },
    };
    expect(loanTerms(state, player, weakBuyer).available).toBe(true);
  });
  it('permite ao usuário emprestar titular, promessa e jogador com sequência', () => {
    const owner = state.clubs.byId[state.participants[0]!.clubId]!;
    const player = state.players.byId[owner.playerIds[0]!]!;
    state.workload[player.id] = { ...state.workload[player.id]!, consecutiveMatches: 10 };
    state.management = {
      ...state.management,
      contracts: { [player.id]: state.lastProcessedAt + 181 * 86400000 },
    };
    expect(loanTerms(state, player).eligible).toBe(true);
    expect(loanTerms(state, player).maxMonths).toBe(6);
    act({
      type: 'management',
      action: 'policy',
      playerId: player.id,
      loanAvailable: true,
      available: false,
    });
    expect(state.management?.policies?.[player.id]?.loanAvailable).toBe(true);
    state.management.contracts![player.id] = state.lastProcessedAt + 180 * 86400000;
    expect(loanTerms(state, player).eligible).toBe(false);
  });
  it.each([50, 75, 100] as const)(
    'conserva o salário e devolve o jogador (%i%%)',
    (salaryPercent) => {
      const { buyer, seller, player } = target();
      act({
        type: 'management',
        action: 'offer-loan',
        playerId: player.id,
        months: 6,
        salaryPercent,
      });
      expect(state.players.byId[player.id]?.clubId).toBe(buyer.id);
      expect(state.players.byId[player.id]?.salary).toEqual(player.salary);
      expect(loanWage(state, player.id, buyer.id) + loanWage(state, player.id, seller.id)).toBe(
        player.salary.cents,
      );
      const endsAt = state.management!.loans![player.id]!.endsAt;
      expect(returnLoans(state, endsAt - 1)).toBe(state);
      state = returnLoans(state, endsAt);
      expect(state.players.byId[player.id]?.clubId).toBe(seller.id);
      expect(state.clubs.byId[seller.id]?.playerIds.filter((id) => id === player.id)).toHaveLength(
        1,
      );
      expect(state.clubs.byId[buyer.id]?.playerIds).not.toContain(player.id);
      expect(state.management?.loans?.[player.id]).toBeUndefined();
      expect(worldStateSchema.safeParse(state).success).toBe(true);
    },
  );
  it('bloqueia empréstimo com contrato de 6 meses ou menos', () => {
    const { player } = target();
    state = {
      ...state,
      management: {
        ...state.management,
        contracts: { [player.id]: state.lastProcessedAt + 180 * 86400000 },
      },
    };
    expect(
      executeCommand(
        state,
        {
          type: 'management',
          action: 'offer-loan',
          playerId: player.id,
          months: 6,
          salaryPercent: 50,
        },
        'host',
        now,
        stableId(993, 1),
      ).ok,
    ).toBe(false);
  });
  it('preserva a devolução no avanço diário e impede revenda pelo tomador', () => {
    const { player, seller } = target();
    act({
      type: 'management',
      action: 'offer-loan',
      playerId: player.id,
      months: 6,
      salaryPercent: 75,
    });
    expect(
      executeCommand(
        state,
        { type: 'management', action: 'policy', playerId: player.id, available: true },
        'host',
        now,
        stableId(993, 2),
      ).ok,
    ).toBe(false);
    state = advanceGameDays(state, state.lastProcessedAt + 180 * 86400000);
    expect(state.players.byId[player.id]?.clubId).toBe(seller.id);
    expect(state.management?.loans?.[player.id]).toBeUndefined();
  });
});

it('uma proposta recebida preserva o salário integral e cobra a parte de cada clube', () => {
  const owner = state.clubs.byId[state.participants[0]!.clubId]!;
  const borrower = Object.values(state.clubs.byId).find((c) => c.id !== owner.id)!;
  const original = state.players.byId[owner.playerIds.at(-1)!]!;
  const player = { ...original, overall: 40, potential: 42, age: 28 };
  state = {
    ...state,
    players: { ...state.players, byId: { ...state.players.byId, [player.id]: player } },
  };
  const salary = Math.ceil((player.salary.cents * 0.75) / 10000) * 10000;
  state = {
    ...state,
    management: {
      ...state.management,
      contracts: { ...state.management?.contracts, [player.id]: now + 3 * 365 * 86400000 },
      policies: {
        [player.id]: { available: false, loanAvailable: true, rivals: true, interest: 75 },
      },
      offers: [
        {
          id: 'incoming-loan',
          playerId: player.id,
          sellerId: owner.id,
          buyerId: borrower.id,
          kind: 'loan',
          months: 6,
          salaryPercent: 75,
          fee: 0,
          salary,
          status: 'pending',
        },
      ],
    },
  };
  act({ type: 'management', action: 'accept', offerId: 'incoming-loan' });
  expect(state.players.byId[player.id]?.clubId).toBe(borrower.id);
  expect(state.management?.offers?.[0]?.status).toBe('accepted');
  const expectedOwner = owner.playerIds.reduce((sum, id) => sum + loanWage(state, id, owner.id), 0);
  const expectedBorrower = state.clubs.byId[borrower.id]!.playerIds.reduce(
    (sum, id) => sum + loanWage(state, id, borrower.id),
    0,
  );
  const next = settleMonthly(state, Date.parse('2026-02-01T03:00:00Z'));
  expect(next.management?.charges?.find((c) => c.clubId === owner.id)?.wages).toBe(expectedOwner);
  expect(next.management?.charges?.find((c) => c.clubId === borrower.id)?.wages).toBe(
    expectedBorrower,
  );
  expect(state.players.byId[player.id]?.salary.cents).toBe(player.salary.cents);
});

it.each([6, 12])('preserva o prazo na troca de temporada (%i meses)', (months) => {
  state = { ...state, lastProcessedAt: now + 90 * 86400000 };
  const { player, seller, buyer } = target();
  act({
    type: 'management',
    action: 'offer-loan',
    playerId: player.id,
    months,
    salaryPercent: 100,
  });
  state = { ...state, status: 'finished' };
  act({ type: 'new-season' });
  expect(state.players.byId[player.id]?.clubId).toBe(months === 6 ? seller.id : buyer.id);
  expect(Boolean(state.management?.loans?.[player.id])).toBe(months === 12);
});
