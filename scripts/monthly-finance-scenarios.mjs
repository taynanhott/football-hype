import fs from 'node:fs';
import { roundSponsorship } from '../packages/domain/dist/finance/sponsorship.js';
import { facilityCosts } from '../packages/domain/dist/finance/facility-costs.js';
import { projectTicketDemand, TICKET_TIERS } from '../packages/domain/dist/finance/match-demand.js';
import { stadiumBenefits } from '../packages/domain/dist/finance/stadium-benefits.js';
const d = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const rows = Object.values(d.clubs.byId).map((c) => {
  const s = d.stadiums.byId[c.stadiumId],
    center = d.centers.byId[c.trainingCenterId];
  const capacity = s.sectors.reduce((n, x) => n + x.capacity, 0),
    m = center.levels.marketing;
  const sponsor = roundSponsorship(c, m) * 4;
  const projections = [0.85, 1.08].flatMap((demandFactor) =>
    TICKET_TIERS.map((t) => {
      const p = projectTicketDemand(
        {
          capacity,
          commerce: stadiumBenefits(s).commerce,
          selloutPriceCents: TICKET_TIERS[0].priceCents,
          minimumCrowdPriceCents: TICKET_TIERS[3].priceCents,
          demandFactor,
        },
        t.priceCents,
      );
      const commerce = Math.round((p.consumptionRevenue * (m >= 4 ? 1.2 : 1)) / 10000) * 10000;
      return {
        tier: t.label,
        ticket: t.priceCents / 100,
        demandFactor,
        attendance: p.attendance,
        ticketIncome: (p.ticketRevenue * 2) / 100,
        commerceIncome: (commerce * 2) / 100,
        sponsorship: sponsor / 100,
        revenue: (p.ticketRevenue + commerce) * 2 + sponsor,
      };
    }),
  );
  const low = projections.reduce((a, b) => (a.revenue < b.revenue ? a : b)),
    high = projections.reduce((a, b) => (a.revenue > b.revenue ? a : b));
  const wages = c.playerIds.reduce((n, id) => n + d.players.byId[id].salary.cents, 0),
    infra = facilityCosts(d, c).reduce((n, x) => n + x.cost, 0);
  return {
    name: c.name,
    country: c.country,
    division: c.division,
    cash: c.balance.cents / 100,
    capacity,
    wages: wages / 100,
    infra: infra / 100,
    min: low.revenue / 100,
    max: high.revenue / 100,
    netMin: (low.revenue - wages - infra) / 100,
    netMax: (high.revenue - wages - infra) / 100,
    costs: (wages + infra) / 100,
    sponsor: sponsor / 100,
    scenarios: projections.map((p) => ({
      ...p,
      revenue: p.revenue / 100,
      net: (p.revenue - wages - infra) / 100,
    })),
    low: low.tier,
    high: high.tier,
  };
});
const minimum = Math.min(...rows.map((x) => x.cash)),
  brazil = rows.filter((x) => x.country === 'BR'),
  maximum = Math.max(...brazil.map((x) => x.cash));
const average = (rs) =>
  Object.fromEntries(
    ['cash', 'capacity', 'wages', 'infra', 'min', 'max', 'netMin', 'netMax'].map((k) => [
      k,
      rs.reduce((n, r) => n + r[k], 0) / rs.length,
    ]),
  );
const summary = {
  poorestTies: rows.filter((x) => x.cash === minimum).length,
  poorest: rows.filter((x) => x.cash === minimum).slice(0, 3),
  richestTies: brazil.filter((x) => x.cash === maximum).length,
  richest: brazil.filter((x) => x.cash === maximum).slice(0, 3),
  divisions: ['A', 'B', 'C', 'D'].map((v) => ({
    division: v,
    count: brazil.filter((x) => x.division === v).length,
    ...average(brazil.filter((x) => x.division === v)),
  })),
};
const report = {
  assumptions: {
    homeMatches: 2,
    sponsorshipRounds: 4,
    demandFactors: [0.85, 1.08],
    currency: 'HC$',
    amounts: 'whole units, converted from cents',
    tickets: TICKET_TIERS.map((t) => ({ label: t.label, price: t.priceCents / 100 })),
    excludes: ['transferências', 'premiações', 'compras de estruturas', 'eventos extraordinários'],
  },
  summary,
  rows,
};
fs.writeFileSync('docs/monthly-finance-scenarios.json', JSON.stringify(report, null, 2));
const money = (value) => 'HC$ ' + Math.round(value).toLocaleString('pt-BR');
const md = [
  '# Simulação mensal por clube',
  '',
  'Base atual de salários. Dois jogos em casa, quatro parcelas de patrocínio e procura entre 85% e 108% do público de cada faixa. Faixas de ingresso: Barato, Normal, Caro e Abusivo. Valores em HC$, sem escala em milhares.',
  '',
  'Não inclui transferências, premiações, compras de estruturas ou eventos extraordinários. Elencos estrangeiros parciais podem subestimar gastos.',
  '',
  '| Clube | País | Divisão | Folha mensal | Estruturas | Receita mínima | Receita máxima | Lucro mínimo | Lucro máximo |',
  '|---|---|---|---:|---:|---:|---:|---:|---:|',
  ...[...rows]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map(
      (r) =>
        '| ' +
        [
          r.name,
          r.country,
          r.division,
          money(r.wages),
          money(r.infra),
          money(r.min),
          money(r.max),
          money(r.netMin),
          money(r.netMax),
        ].join(' | ') +
        ' |',
    ),
].join('\n');
fs.writeFileSync('docs/monthly-finance-scenarios.md', md);
console.log(
  JSON.stringify(
    {
      ...summary,
      clubs: rows.length,
      negativeEvenBest: rows
        .filter((r) => r.netMax < 0)
        .map((r) => ({ name: r.name, net: r.netMax })),
      negativeWorst: rows.filter((r) => r.netMin < 0).length,
      samples: rows.filter((r) =>
        [
          'Flamengo',
          'Manchester City',
          'Real Madrid',
          'Corinthians',
          'Barcelona',
          'Paris Saint-Germain',
        ].includes(r.name),
      ),
    },
    null,
    2,
  ),
);
