import { COMPETITIONS, type WorldState } from '@football/shared';
import { standings } from './standings.js';
import { europeanLeagueView } from './european-leagues.js';
import { scheduledFixtures } from './fixtures.js';
export const SERIE_B_PRIZES = [
  15000, 14300, 13600, 12900, 12200, 11500, 10800, 10100, 9400, 8700, 8000, 7300, 6600, 5900, 5200,
  4500, 3800, 3100, 2400, 2000,
];
export const SERIE_C_PRIZES = [
  7000, 6700, 6400, 6100, 5800, 5500, 5200, 4900, 4600, 4300, 4000, 3700, 3400, 3100, 2800, 2500,
  2200, 1900, 1600, 1300,
];
export function leaguePrize(division: string, rank: number): number {
  const base = division === 'A' || division === 'B' ? SERIE_B_PRIZES[rank] : SERIE_C_PRIZES[rank];
  return base === undefined
    ? 0
    : Math.round((base * (division === 'A' ? 2 : division === 'D' ? 0.5 : 1)) / 100) * 100;
}
/** All credits and their idempotency records are persisted together with the final match. */
export function settleCompetitionPrizes(state: WorldState): WorldState {
  if (scheduledFixtures(state).some((f) => !state.results.some((r) => r.fixtureId === f.id)))
    return state;
  const payments = [...(state.competitionPayments ?? [])];
  const clubs = { ...state.clubs.byId };
  function pay(competitionId: string, clubId: string, units: number) {
    if (
      !units ||
      !clubs[clubId] ||
      payments.some(
        (p) =>
          p.season === state.season && p.competitionId === competitionId && p.clubId === clubId,
      )
    )
      return;
    const amountCents = units * 100,
      club = clubs[clubId]!;
    if (!Number.isSafeInteger(club.balance.cents + amountCents))
      throw new Error('Saldo fora do limite seguro');
    clubs[clubId] = {
      ...club,
      balance: { ...club.balance, cents: club.balance.cents + amountCents },
    };
    payments.push({
      season: state.season,
      competitionId,
      clubId,
      amountCents,
      paidAt: state.lastProcessedAt,
    });
  }
  for (const rule of COMPETITIONS.filter((r) => r.format === 'league' && r.division)) {
    const fixtures = state.fixtures.filter((f) => f.competitionId === rule.id && !f.group);
    if (!fixtures.length) continue;
    const table = standings(
      state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === rule.division),
      fixtures,
      state.results,
      rule.tieBreakers,
    );
    table.forEach((row, i) => pay(rule.id, row.id, leaguePrize(rule.division!, i)));
  }
  for (const league of state.europeanLeagues?.leagues ?? []) {
    if (league.scores.length !== 38) continue;
    const winner = europeanLeagueView(league, state.season).table[0];
    if (winner) pay(league.competitionId, winner.id, 90000);
  }
  for (const [id, amount] of Object.entries({
    libertadores: 45000,
    'sul-americana': 20000,
    'copa-brasil': 30000,
    europa: 150000,
  })) {
    const final = state.cups.find(
      (n) =>
        n.competitionId === id && !state.cups.some((p) => p.leftId === n.id || p.rightId === n.id),
    );
    if (final?.winnerId) pay(id, final.winnerId, amount);
  }
  for (const id of ['copa-nordeste', 'copa-sul-sudeste', 'copa-verde']) {
    const nodes = state.cups.filter((n) => n.competitionId === id);
    const participants = new Set(
      state.fixtures.filter((f) => f.competitionId === id).flatMap((f) => [f.homeId, f.awayId]),
    );
    nodes.forEach((n) => {
      if (n.homeId) participants.add(n.homeId);
      if (n.awayId) participants.add(n.awayId);
    });
    const rounds = [...new Set(nodes.map((n) => n.round))].sort((a, b) => b - a);
    const finalRound = rounds[0],
      semiRound = rounds[1],
      quarterRound = rounds[2];
    for (const clubId of participants) {
      let units = 1300;
      for (const [round, bonus] of [
        [quarterRound, 1000],
        [semiRound, 1300],
        [finalRound, 1500],
      ] as const)
        if (
          round !== undefined &&
          nodes.some((n) => n.round === round && (n.homeId === clubId || n.awayId === clubId))
        )
          units += bonus;
      if (nodes.some((n) => n.round === finalRound && n.winnerId === clubId)) units += 2000;
      pay(id, clubId, units);
    }
  }
  return payments.length === (state.competitionPayments ?? []).length
    ? state
    : { ...state, clubs: { ...state.clubs, byId: clubs }, competitionPayments: payments };
}
