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
          selloutPriceCents: 5000000,
          minimumCrowdPriceCents: 20000000,
          demandFactor,
        },
        t.priceCents,
      );
      const commerce = Math.round((p.consumptionRevenue * (m >= 4 ? 1.2 : 1)) / 10000) * 10000;
      return { tier: t.label, revenue: (p.ticketRevenue + commerce) * 2 + sponsor };
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
    cash: c.balance.cents / 100000,
    capacity,
    wages: wages / 100000,
    infra: infra / 100000,
    min: low.revenue / 100000,
    max: high.revenue / 100000,
    netMin: (low.revenue - wages - infra) / 100000,
    netMax: (high.revenue - wages - infra) / 100000,
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
console.log(
  JSON.stringify(
    {
      poorestTies: rows.filter((x) => x.cash === minimum).length,
      poorest: rows.filter((x) => x.cash === minimum).slice(0, 3),
      richestTies: brazil.filter((x) => x.cash === maximum).length,
      richest: brazil.filter((x) => x.cash === maximum).slice(0, 3),
      divisions: ['A', 'B', 'C', 'D'].map((v) => ({
        division: v,
        count: brazil.filter((x) => x.division === v).length,
        ...average(brazil.filter((x) => x.division === v)),
      })),
    },
    null,
    2,
  ),
);
