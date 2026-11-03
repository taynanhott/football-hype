import { roundSponsorship } from '../src/finance/sponsorship.js';
import { it, expect } from 'vitest';
import type { WorldState } from '@football/shared';
import fs from 'node:fs';
import { facilityCosts } from '../src/finance/facility-costs.ts';
import { projectTicketDemand } from '../src/finance/match-demand.ts';
it('sustenta os clubes com dois jogos em casa e quatro rodadas de patrocínio', () => {
  const data = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8')) as WorldState;
  const rows = Object.values(data.clubs.byId).map((club) => {
    const stadium = data.stadiums.byId[club.stadiumId];
    const capacity = stadium.sectors.reduce((sum, s) => sum + s.capacity, 0);
    const expenses =
      club.playerIds.reduce((sum, id) => sum + data.players.byId[id].salary.cents, 0) +
      facilityCosts(data, club).reduce((sum, item) => sum + item.cost, 0);
    const gate = projectTicketDemand(
      {
        capacity,
        commerce: 0,
        selloutPriceCents: 5000000,
        minimumCrowdPriceCents: 20000000,
        demandFactor: 0.85,
      },
      10000000,
    ).revenue;
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
    selloutPriceCents: 5000000,
    minimumCrowdPriceCents: 20000000,
  };
  const cheap = projectTicketDemand(parameters, 5000000);
  const normal = projectTicketDemand(parameters, 10000000);
  const expensive = projectTicketDemand(parameters, 15000000);
  const abusive = projectTicketDemand(parameters, 20000000);
  expect(cheap.attendance).toBeGreaterThan(normal.attendance);
  expect(normal.attendance).toBeGreaterThan(expensive.attendance);
  expect(expensive.attendance).toBeGreaterThan(abusive.attendance);
  expect(normal.revenue).toBeGreaterThan(cheap.revenue);
  expect(normal.revenue).toBeGreaterThan(expensive.revenue);
  expect(normal.revenue).toBeGreaterThan(abusive.revenue);
  expect(projectTicketDemand({ ...parameters, capacity: 14400 }, 10000000).revenue).toBeGreaterThan(
    normal.revenue,
  );
});

it('limita a vantagem financeira dos estádios grandes', () => {
  const parameters = {
    capacity: 36000,
    commerce: 32,
    selloutPriceCents: 5000000,
    minimumCrowdPriceCents: 20000000,
    demandFactor: 1.08,
  };
  const revenue = projectTicketDemand(parameters, 10000000);
  expect(revenue.revenue / 100000).toBeLessThan(10000);
  expect(revenue.consumptionRevenue).toBeLessThan(revenue.ticketRevenue);
  expect(revenue.ticketRevenue % 5000000).toBe(0);
  expect(revenue.consumptionRevenue % 5000000).toBe(0);
});
