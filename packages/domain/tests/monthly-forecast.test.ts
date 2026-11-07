import { describe, expect, it, vi } from 'vitest';
import type { WorldState } from '@football/shared';
import { createWorld, stableId } from '../src/index.js';
import { currentMonthForecast } from '../src/finance/monthly-forecast.js';
import { matchDemand } from '../src/finance/match-demand.js';
import { shareMatchRevenue } from '../src/finance/gate-sharing.js';
import { clubPayroll } from '../src/finance/financial-management.js';
import { monthlyStructureCost } from '../src/finance/facility-costs.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
vi.mock('../src/competitions/fixtures.js', () => ({
  scheduledFixtures: (state: WorldState) => state.fixtures,
}));
const original = unwrap(
  createWorld({
    id: stableId(813, 1),
    userId: 'host',
    name: 'Estimativa',
    mode: 'offline',
    now: Date.UTC(2026, 0, 15, 12),
  }),
);
const club = original.clubs.byId[original.participants[0]!.clubId]!;
const away = original.clubs.ids.find((id) => id !== club.id)!;
const fixture = {
  ...original.fixtures[0]!,
  id: 'forecast-home',
  homeId: club.id,
  awayId: away,
  competitionId: 'serie-a',
  scheduledAt: original.lastProcessedAt + 86400000,
};
const state = { ...original, fixtures: [fixture], cups: [], results: [] };
describe('estimativa mensal de lucro', () => {
  it('usa público por partida e participação na bilheteria sem alterar o saldo', () => {
    const before = JSON.stringify(state);
    const forecast = currentMonthForecast(state, club, []);
    const demand = matchDemand(state, fixture);
    expect(forecast.matchRevenue).toBe(
      shareMatchRevenue(demand.ticketRevenue, demand.revenue).home,
    );
    expect(forecast.averageAttendance).toBe(demand.attendance);
    expect(forecast.averageTicketPrice).toBe(demand.priceCents);
    expect(forecast.profit).toBe(forecast.income - forecast.expenses);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('não repete partidas realizadas, exclui o mês seguinte e desconta custos uma vez', () => {
    const costs = clubPayroll(state, club) + monthlyStructureCost(state, club);
    const noGames = {
      ...state,
      fixtures: [{ ...fixture, scheduledAt: Date.UTC(2026, 1, 2) }],
      management: {
        ...state.management,
        financialHistory: [
          { clubId: club.id, month: '2026-01', income: 500000, expenses: costs, fixedCosts: costs },
        ],
      },
    };
    const forecast = currentMonthForecast(noGames, club, []);
    expect(forecast.remainingGames).toBe(0);
    expect(forecast.pendingCosts).toBe(0);
    expect(forecast.profit).toBe(500000 - costs);
  });
  it('inclui a receita de visitante e aumenta a projeção para mata-mata', () => {
    const visiting = { ...fixture, homeId: away, awayId: club.id };
    const visitState = { ...state, fixtures: [visiting] };
    const demand = matchDemand(visitState, visiting);
    expect(currentMonthForecast(visitState, club, []).matchRevenue).toBe(
      shareMatchRevenue(demand.ticketRevenue, demand.revenue).away,
    );
    const final = { ...fixture, id: 'final', competitionId: 'copa-brasil' };
    const cupState = {
      ...state,
      fixtures: [final],
      cups: [{ ...final, leftId: null, rightId: null, winnerId: null }],
    };
    expect(currentMonthForecast(cupState, club, []).matchRevenue).toBeGreaterThan(
      currentMonthForecast(state, club, []).matchRevenue,
    );
  });
});
