import { beforeEach, describe, it, expect } from 'vitest';
import { type WorldState } from '@football/shared';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  clubPayroll,
  financialLimits,
  monthlyFinancialReport,
  recordEvent,
  recordFinancialHistory,
  transferContext,
} from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
beforeEach(() => {
  state = unwrap(
    createWorld({ id: stableId(95, 1), name: 'Finanças', mode: 'offline', userId: 'host', now }),
  );
});
const own = () => state.clubs.byId[state.participants[0]!.clubId]!;
function act(command: Parameters<typeof executeCommand>[1]) {
  return unwrap(
    applyEvent(
      state,
      unwrap(executeCommand(state, command, 'host', now, stableId(96, state.revision + 1))),
    ),
  );
}

describe('limites financeiros autoritativos', () => {
  it('salva a distribuição, impede exceder o caixa e considera a folha existente', () => {
    const club = own(),
      payroll = clubPayroll(state, club),
      salaryCap = payroll + 10000000,
      transfer = 100000000;
    state = act({ type: 'financial-plan', transfer, salaries: salaryCap });
    expect(financialLimits(state, club)).toMatchObject({
      configured: true,
      transfer,
      salary: 10000000,
      payroll,
      salaryCap,
    });
    expect(
      executeCommand(
        state,
        { type: 'financial-plan', transfer: club.balance.cents, salaries: 500 },
        'host',
        now,
        stableId(97, 1),
      ).ok,
    ).toBe(false);
  });
  it('bloqueia novas contratações se não sobrar teto salarial e aceita orçamento zerado', () => {
    const club = own(),
      player = Object.values(state.players.byId).find((p) => p.clubId === null)!;
    state = act({ type: 'financial-plan', transfer: 0, salaries: clubPayroll(state, club) });
    expect(financialLimits(state, club).salary).toBe(0);
    const salary = transferContext(state, player, club).minimumSalary;
    expect(
      executeCommand(
        state,
        { type: 'sign-free', playerId: player.id, salary },
        'host',
        now,
        stableId(97, 2),
      ).ok,
    ).toBe(false);
    expect(state.players.byId[player.id]!.clubId).toBeNull();
    expect(state.negotiations).toHaveLength(0);
    state = act({ type: 'financial-plan', transfer: 0, salaries: 0 });
    expect(financialLimits(state, club)).toMatchObject({ transfer: 0, salary: 0 });
  });
  it('reduz a verba após uma compra, sem reabrir o limite ao contratar', () => {
    const club = own(),
      player = Object.values(state.players.byId).find((p) => p.clubId && p.clubId !== club.id)!;
    const fee = transferContext(state, player, club).minimumFee,
      salary = transferContext(state, player, club, fee).minimumSalary;
    const transfer = fee + 10000000,
      salaries = clubPayroll(state, club) + salary + 10000000;
    state = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: {
            ...club,
            balance: { ...club.balance, cents: transfer + salaries + 100000000 },
          },
        },
      },
    };
    state = act({ type: 'financial-plan', transfer, salaries });
    state = act({ type: 'offer', playerId: player.id, fee });
    expect(financialLimits(state, own()).transfer).toBe(10000000);
    const negotiation = state.negotiations.at(-1)!;
    state = act({ type: 'salary', negotiationId: negotiation.id, salary });
    expect(state.management?.financialPlans?.[club.id]?.transfer).toBe(10000000);
    expect(financialLimits(state, own()).salary).toBe(10000000);
  });
  it('revalida limites antes de assinar uma negociação já iniciada', () => {
    const player = Object.values(state.players.byId).find((p) => p.clubId === null)!;
    state = act({ type: 'offer', playerId: player.id, fee: 0 });
    const offer = state.negotiations.at(-1)!;
    state = act({ type: 'financial-plan', transfer: 0, salaries: 0 });
    expect(
      executeCommand(
        state,
        { type: 'salary', negotiationId: offer.id, salary: 1000000 },
        'host',
        now,
        stableId(97, 3),
      ).ok,
    ).toBe(false);
  });
});
describe('relatórios mensais de caixa', () => {
  it('separa receita bruta e pagamentos no mesmo evento e respeita o mês das cobranças', () => {
    const club = own();
    const next: WorldState = {
      ...state,
      lastProcessedAt: Date.parse('2026-02-02T15:00:00Z'),
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, balance: { ...club.balance, cents: club.balance.cents + 7000000 } },
        },
      },
      management: {
        charges: [
          { clubId: club.id, month: '2026-02', wages: 2000000, maintenance: 1000000, unpaid: 0 },
        ],
      },
    };
    const event = unwrap(
      recordEvent(state, next, {
        id: stableId(98, 1),
        occurredAt: now,
        actorId: 'host',
        type: 'round.played',
        message: 'Rodada',
        amount: 0,
      }),
    );
    const saved = unwrap(applyEvent(state, event));
    const report = monthlyFinancialReport(saved, club.id, []);
    expect(report.current).toMatchObject({
      month: '2026-02',
      income: 10000000,
      expenses: 3000000,
      fixedCosts: 3000000,
      profit: 7000000,
    });
    expect(report.averageProfit).toBe(3500000);
    expect(report.months).toHaveLength(2);
    expect(recordFinancialHistory(saved, saved)).toBe(saved);
  });
  it('mostra prejuízo, inclui meses vazios e não duplica movimentos antigos na migração', () => {
    const club = own();
    state = {
      ...state,
      lastProcessedAt: Date.parse('2026-03-20T15:00:00Z'),
      management: {
        historyStartedAtRevision: 3,
        financialHistory: [
          {
            clubId: club.id,
            month: '2026-03',
            income: 1000000,
            expenses: 5000000,
            fixedCosts: 2000000,
          },
        ],
      },
    };
    const ledger = [
      { sequence: 1, occurredAt: now, balances: { [club.id]: 2000000 } },
      {
        sequence: 3,
        occurredAt: Date.parse('2026-03-20T15:00:00Z'),
        balances: { [club.id]: -4000000 },
      },
    ];
    const report = monthlyFinancialReport(state, club.id, ledger);
    expect(report.income).toBe(3000000);
    expect(report.expenses).toBe(5000000);
    expect(report.current.profit).toBe(-4000000);
    expect(report.months.find((m) => m.month === '2026-02')?.profit).toBe(0);
    expect(report.averageProfit).toBe(-2000000 / 3);
    expect(report.legacy).toBe(true);
  });
  it('não contabiliza salários não pagos como saída de caixa', () => {
    const club = own();
    const before = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, balance: { ...club.balance, cents: 0 } },
        },
      },
    };
    const next = {
      ...before,
      lastProcessedAt: Date.parse('2026-02-02T15:00:00Z'),
      management: {
        charges: [
          {
            clubId: club.id,
            month: '2026-02',
            wages: 2000000,
            maintenance: 1000000,
            unpaid: 3000000,
          },
        ],
      },
    };
    const report = monthlyFinancialReport(recordFinancialHistory(before, next), club.id, []);
    expect(report.current.expenses).toBe(0);
    expect(report.current.fixedCosts).toBe(3000000);
    expect(report.current.profit).toBe(0);
  });
});

describe('economia das estruturas e reservas', () => {
  it('cada setor tem custos próprios e níveis aumentam a manutenção e o upgrade', async () => {
    const { maintenanceForLevel, upgradePrice } = await import('../src/index.js');
    expect(maintenanceForLevel(1, 'medical')).toBeGreaterThan(maintenanceForLevel(1, 'shirts'));
    expect(upgradePrice(1, 'structure')).toBeGreaterThan(upgradePrice(1, 'food'));
    for (const target of ['pitch', 'medical', 'structure', 'marketing']) {
      expect(maintenanceForLevel(5, target)).toBeGreaterThan(maintenanceForLevel(4, target));
      expect(upgradePrice(4, target)).toBeGreaterThan(upgradePrice(3, target));
    }
  });
  it('permite alocar todo o caixa para compras, sem descontar despesas futuras', () => {
    const club = own();
    state = act({ type: 'financial-plan', transfer: club.balance.cents, salaries: 0 });
    expect(financialLimits(state, club).transfer).toBe(club.balance.cents);
    const indebted = { ...state, debts: { ...state.debts, [club.id]: club.balance.cents } };
    expect(financialLimits(indebted, club).transfer).toBe(club.balance.cents);
    expect(financialLimits(state, club).salary).toBe(0);
  });
  it('o gráfico da temporada não mistura exercícios diferentes', async () => {
    const { seasonFinancialReport } = await import('../src/index.js');
    const club = own();
    const sample = {
      ...state,
      management: {
        financialHistory: [
          {
            clubId: club.id,
            month: '2026-01',
            income: 5000000,
            expenses: 1000000,
            fixedCosts: 0,
            season: 2025,
          },
          {
            clubId: club.id,
            month: '2026-01',
            income: 9000000,
            expenses: 3000000,
            fixedCosts: 0,
            season: 2026,
          },
        ],
      },
    };
    expect(seasonFinancialReport(sample, club.id, [])).toEqual({
      income: 9000000,
      expenses: 3000000,
      profit: 6000000,
    });
  });
});
