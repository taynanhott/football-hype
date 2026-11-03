import { ticketAmountSchema } from '@football/shared';
import { roundSponsorship } from '../src/finance/sponsorship.js';
import { it, expect } from 'vitest';
import type { WorldState } from '@football/shared';
import fs from 'node:fs';
import { facilityCosts } from '../src/finance/facility-costs.ts';
import { TICKET_TIERS, projectTicketDemand } from '../src/finance/match-demand.ts';
it('sustenta os clubes na melhor faixa com dois jogos em casa e quatro rodadas de patrocínio', () => {
  const data = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8')) as WorldState;
  const rows = Object.values(data.clubs.byId).map((club) => {
    const stadium = data.stadiums.byId[club.stadiumId];
    const capacity = stadium.sectors.reduce((sum, s) => sum + s.capacity, 0);
    const expenses =
      club.playerIds.reduce((sum, id) => sum + data.players.byId[id].salary.cents, 0) +
      facilityCosts(data, club).reduce((sum, item) => sum + item.cost, 0);
    const gate = Math.max(
      ...TICKET_TIERS.map(
        (tier) =>
          projectTicketDemand(
            {
              capacity,
              commerce: 0,
              selloutPriceCents: 5000,
              minimumCrowdPriceCents: 40000,
              demandFactor: 0.85,
            },
            tier.priceCents,
          ).revenue,
      ),
    );
    const marketing = data.centers.byId[club.trainingCenterId].levels.marketing;
    const sponsor = roundSponsorship(club, marketing);
    const income = gate * 2 + sponsor * 4;
    return {
      name: club.name,
      capacity,
      expenses: expenses / 100000,
      income: income / 100000,
      margin: (income - expenses) / 100000,
    };
  });
  rows.sort((a, b) => a.margin - b.margin);

  expect(rows.filter((r) => r.margin < 0)).toEqual([]);
});

it('reduz público nas faixas caras e aumenta renda com a capacidade', () => {
  const parameters = {
    capacity: 7200,
    commerce: 0,
    selloutPriceCents: 5000,
    minimumCrowdPriceCents: 20000,
  };
  const cheap = projectTicketDemand(parameters, 5000);
  const normal = projectTicketDemand(parameters, 10000);
  const expensive = projectTicketDemand(parameters, 20000);
  const abusive = projectTicketDemand(parameters, 40000);
  expect(cheap.attendance).toBeGreaterThan(normal.attendance);
  expect(normal.attendance).toBeGreaterThan(expensive.attendance);
  expect(expensive.attendance).toBeGreaterThan(abusive.attendance);
  expect(normal.revenue).toBeGreaterThan(cheap.revenue);
  expect(expensive.revenue).toBeGreaterThan(normal.revenue);
  expect(normal.revenue).toBe(abusive.revenue);
  expect(projectTicketDemand({ ...parameters, capacity: 14400 }, 10000).revenue).toBeGreaterThan(
    normal.revenue,
  );
});

it('calcula bilheteria pelo preço individual e público presente', () => {
  const parameters = {
    capacity: 36000,
    commerce: 32,
    selloutPriceCents: 5000,
    minimumCrowdPriceCents: 20000,
    demandFactor: 1.08,
  };
  const revenue = projectTicketDemand(parameters, 10000);
  expect(revenue.ticketRevenue).toBe(revenue.attendance * revenue.priceCents);
  expect(revenue.consumptionRevenue).toBeLessThan(revenue.ticketRevenue);
  expect(revenue.ticketRevenue % 100).toBe(0);
  expect(revenue.consumptionRevenue % 5000).toBe(0);
});

it('converte preços antigos sem reescalar os preços já corrigidos', () => {
  expect(ticketAmountSchema.parse(10000000)).toBe(10000);
  expect(ticketAmountSchema.parse(10000)).toBe(10000);
  expect(ticketAmountSchema.parse(50000)).toBe(50000);
});

it('oferece preços fixos de 50, 100, 200 e 400 sem multiplicar pelo clube', () => {
  const p = {
    capacity: 10000,
    commerce: 0,
    selloutPriceCents: 5000,
    minimumCrowdPriceCents: 40000,
    fairPriceCents: 25000,
  };
  for (const price of [5000, 10000, 20000, 40000])
    expect(projectTicketDemand(p, price).priceCents).toBe(price);
});
