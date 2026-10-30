import { beforeEach, describe, expect, it } from 'vitest';
import type { GameCommand, WorldState } from '@football/shared';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  transferContext,
} from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
beforeEach(() => {
  state = unwrap(
    createWorld({ id: stableId(195, 1), name: 'Negociação', mode: 'offline', userId: 'host', now }),
  );
});
function setup() {
  const buyer = state.clubs.byId[state.participants[0]!.clubId]!;
  const player = Object.values(state.players.byId).find((p) => p.clubId && p.clubId !== buyer.id)!;
  state = {
    ...state,
    clubs: {
      ...state.clubs,
      byId: {
        ...state.clubs.byId,
        [buyer.id]: { ...buyer, balance: { ...buyer.balance, cents: 1000000000000 } },
      },
    },
  };
  return { buyer: state.clubs.byId[buyer.id]!, player };
}
function act(command: GameCommand) {
  state = unwrap(
    applyEvent(
      state,
      unwrap(executeCommand(state, command, 'host', now, stableId(196, state.revision + 1))),
    ),
  );
}
describe('conversas de transferência', () => {
  it('não revela valores nas três ofertas irrisórias e bloqueia por sete dias', () => {
    const { player } = setup();
    for (let n = 0; n < 3; n++) act({ type: 'offer', playerId: player.id, fee: 0 });
    const reply = state.negotiations.at(-1)!;
    expect(reply.lowAttempts).toBe(3);
    expect(reply.reply).not.toContain('R$');
    expect(reply.blockedUntil).toBe(state.lastProcessedAt + 7 * 86400000);
    expect(
      executeCommand(
        state,
        { type: 'offer', playerId: player.id, fee: player.marketValue.cents * 2 },
        'host',
        now,
        stableId(197, 1),
      ).ok,
    ).toBe(false);
    state = { ...state, lastProcessedAt: state.lastProcessedAt + 7 * 86400000 };
    act({ type: 'offer', playerId: player.id, fee: 0 });
    expect(state.negotiations.at(-1)?.lowAttempts).toBe(1);
  });
  it('revela a pedida numa oferta próxima e mantém o acordo por três dias', () => {
    const { buyer, player } = setup();
    const minimum = transferContext(state, player, buyer).minimumFee;
    act({ type: 'offer', playerId: player.id, fee: Math.floor((minimum * 0.8) / 1000) * 1000 });
    expect(state.negotiations.at(-1)?.revealed).toBe(true);
    expect(state.negotiations.at(-1)?.reply).toContain('R$');
    act({ type: 'offer', playerId: player.id, fee: minimum });
    const agreement = state.negotiations.at(-1)!;
    expect(agreement.status).toBe('salary');
    expect(agreement.expiresAt).toBe(state.lastProcessedAt + 3 * 86400000);
    state = { ...state, lastProcessedAt: state.lastProcessedAt + 3 * 86400000 };
    expect(
      executeCommand(
        state,
        { type: 'salary', negotiationId: agreement.id, salary: agreement.minimumSalary! },
        'host',
        now,
        stableId(198, 1),
      ).ok,
    ).toBe(false);
    act({ type: 'offer', playerId: player.id, fee: minimum });
    expect(state.negotiations.at(-1)?.status).toBe('salary');
  });
  it('fixa a exigência salarial após uma contraproposta recusada', () => {
    const { buyer, player } = setup();
    act({
      type: 'offer',
      playerId: player.id,
      fee: transferContext(state, player, buyer).minimumFee,
    });
    const agreement = state.negotiations.at(-1)!;
    act({ type: 'salary', negotiationId: agreement.id, salary: 0 });
    expect(state.negotiations.at(-1)?.salaryFirm).toBe(true);
    act({ type: 'salary', negotiationId: agreement.id, salary: agreement.minimumSalary! });
    expect(state.negotiations.at(-1)?.status).toBe('completed');
    expect(state.players.byId[player.id]?.clubId).toBe(buyer.id);
  });
});

it('bloqueia a saída de um astro de elite para um elenco e liga muito inferiores', () => {
  const { buyer, player } = setup();
  const seller = state.clubs.byId[player.clubId!]!;
  state = {
    ...state,
    clubs: {
      ...state.clubs,
      byId: {
        ...state.clubs.byId,
        [buyer.id]: { ...buyer, leagueStrength: 65 },
        [seller.id]: { ...seller, leagueStrength: 95 },
      },
    },
    players: {
      ...state.players,
      byId: {
        ...state.players.byId,
        ...Object.fromEntries(
          buyer.playerIds.map((id) => [id, { ...state.players.byId[id]!, overall: 65 }]),
        ),
        [player.id]: { ...player, overall: 94 },
      },
    },
  };
  const context = transferContext(
    state,
    state.players.byId[player.id]!,
    state.clubs.byId[buyer.id]!,
  );
  expect(context.clubInterest).toBe(0);
  expect(context.playerInterest).toBe(0);
  expect(context.blocked).toBe(true);
  expect(
    executeCommand(
      state,
      { type: 'offer', playerId: player.id, fee: player.marketValue.cents * 2 },
      'host',
      now,
      stableId(199, 1),
    ).ok,
  ).toBe(false);
});

it('recupera valor de mercado ausente sem alterar avaliações positivas', async () => {
  const { playerSchema } = await import('@football/shared');
  const { player } = setup();
  const missing = playerSchema.parse({
    ...player,
    marketValue: { ...player.marketValue, cents: 0 },
  });
  expect(missing.marketValue.cents).toBeGreaterThan(0);
  expect(playerSchema.parse(player).marketValue.cents).toBe(player.marketValue.cents);
});

it('conclui a compra com todo o caixa e registra o primeiro salário como dívida', () => {
  const { buyer, player } = setup();
  const fee = transferContext(state, player, buyer).minimumFee;
  state = {
    ...state,
    clubs: {
      ...state.clubs,
      byId: {
        ...state.clubs.byId,
        [buyer.id]: { ...buyer, balance: { ...buyer.balance, cents: fee } },
      },
    },
    management: {
      ...state.management,
      financialPlans: {
        ...state.management?.financialPlans,
        [buyer.id]: { transfer: fee, salaries: 0 },
      },
    },
  };
  act({ type: 'offer', playerId: player.id, fee });
  const agreement = state.negotiations.at(-1)!;
  act({ type: 'salary', negotiationId: agreement.id, salary: agreement.minimumSalary! });
  expect(state.players.byId[player.id]?.clubId).toBe(buyer.id);
  expect(state.clubs.byId[buyer.id]?.balance.cents).toBe(0);
  expect(state.debts[buyer.id]).toBeGreaterThan(0);
});

it('revisa a oferta sem reiniciar o prazo e preserva a resposta anterior', () => {
  const { buyer, player } = setup();
  const fee = transferContext(state, player, buyer).minimumFee;
  act({ type: 'offer', playerId: player.id, fee });
  const first = state.negotiations.at(-1)!;
  state = { ...state, lastProcessedAt: state.lastProcessedAt + 86400000 };
  act({ type: 'offer', playerId: player.id, fee: fee + 1000 });
  const revised = state.negotiations.at(-1)!;
  expect(revised.status).toBe('review');
  expect(revised.reviewAt).toBe(first.reviewAt);
  expect(revised.revised).toBe(true);
  expect(revised.reply).toBe('Aceito a nova oferta, vamos analisar.');
  expect(state.negotiations.find((n) => n.id === first.id)?.reply).toBe(first.reply);
});
it('retira a oferta em análise e bloqueia novas propostas por uma semana', () => {
  const { buyer, player } = setup();
  act({
    type: 'offer',
    playerId: player.id,
    fee: transferContext(state, player, buyer).minimumFee,
  });
  act({ type: 'offer', playerId: player.id, fee: 0, withdraw: true });
  expect(state.negotiations.at(-1)?.withdrawn).toBe(true);
  expect(state.negotiations.at(-1)?.blockedUntil).toBe(state.lastProcessedAt + 7 * 86400000);
  expect(state.negotiations.some((n) => n.playerId === player.id && n.status === 'review')).toBe(
    false,
  );
  expect(
    executeCommand(
      state,
      { type: 'offer', playerId: player.id, fee: player.marketValue.cents * 2 },
      'host',
      now,
      stableId(299, 1),
    ).ok,
  ).toBe(false);
});
it('recusa redução da oferta e aplica bloqueio semanal', () => {
  const { buyer, player } = setup();
  const fee = transferContext(state, player, buyer).minimumFee;
  act({ type: 'offer', playerId: player.id, fee });
  act({ type: 'offer', playerId: player.id, fee: 0 });
  expect(state.negotiations.at(-1)?.status).toBe('rejected');
  expect(state.negotiations.at(-1)?.minimumFee).toBe(fee);
  expect(state.negotiations.at(-1)?.blockedUntil).toBe(state.lastProcessedAt + 7 * 86400000);
});
