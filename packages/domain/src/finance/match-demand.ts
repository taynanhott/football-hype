import { stadiumBenefits } from './stadium-benefits.js';
import {
  GAMEPLAY,
  MONEY_STEPS,
  roundMoney,
  ceilMoney,
  type Fixture,
  type WorldState,
} from '@football/shared';
import { resolveLineup, lineupTacticalBonus } from '../game/tactics.js';
import { tacticalBonus } from '../game/management.js';
import { balancedStrategy } from '../simulation/match.js';
import { scheduledFixtures } from '../competitions/fixtures.js';

export const TICKET_TIERS = [
  {
    label: 'Barato',
    priceCents: 5000,
    occupancy: 0.95,
    description: 'Mais torcida e força em casa.',
  },
  {
    label: 'Normal',
    priceCents: 10000,
    occupancy: 0.72,
    description: 'Equilíbrio entre público e renda.',
  },
  {
    label: 'Caro',
    priceCents: 20000,
    occupancy: 0.43,
    description: 'Ingresso maior, arquibancadas mais vazias.',
  },
  {
    label: 'Abusivo',
    priceCents: 40000,
    occupancy: 0.18,
    description: 'Preço alto afasta a torcida e reduz a renda.',
  },
] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function matchDemand(state: WorldState, fixture: Fixture, priceOverride?: number) {
  const home = state.clubs.byId[fixture.homeId];
  const stadium = state.stadiums.byId[fixture.stadiumId ?? home?.stadiumId ?? ''];
  const capacity = stadium?.sectors.reduce((sum, sector) => sum + sector.capacity, 0) ?? 0;
  const benefits = stadium
    ? stadiumBenefits(stadium)
    : { interest: 0, ticketPremium: 0, commerce: 0 };
  const players = (home?.playerIds ?? []).flatMap((id) =>
    state.players.byId[id] ? [state.players.byId[id]!] : [],
  );
  const morale = players.length
    ? players.reduce((sum, player) => sum + player.morale, 0) / players.length
    : 50;
  const fixtures = new Map(scheduledFixtures(state).map((item) => [item.id, item]));
  const recent = state.results
    .filter((result) => {
      const game = fixtures.get(result.fixtureId);
      return (
        game &&
        game.scheduledAt < fixture.scheduledAt &&
        (game.homeId === fixture.homeId || game.awayId === fixture.homeId)
      );
    })
    .sort((a, b) => fixtures.get(a.fixtureId)!.scheduledAt - fixtures.get(b.fixtureId)!.scheduledAt)
    .slice(-5);
  const form = recent.length
    ? recent.reduce((sum, result) => {
        const game = fixtures.get(result.fixtureId)!;
        const scored = game.homeId === fixture.homeId ? result.homeGoals : result.awayGoals;
        const conceded = game.homeId === fixture.homeId ? result.awayGoals : result.homeGoals;
        return sum + (scored > conceded ? 3 : scored === conceded ? 1 : 0);
      }, 0) /
      (recent.length * 3)
    : 0.5;
  const node = state.cups.find(
    (item) => item.id === fixture.id || `${item.id}:first` === fixture.id,
  );
  const finalRound = Math.max(
    -1,
    ...state.cups
      .filter((item) => item.competitionId === fixture.competitionId)
      .map((item) => item.round),
  );
  const continental = [
    'libertadores',
    'sul-americana',
    'pre-libertadores',
    'intercontinental',
  ].includes(fixture.competitionId);
  const importance = node
    ? node.round === finalRound
      ? 1.6
      : node.round === finalRound - 1
        ? 1.4
        : 1.2
    : continental
      ? 1.2
      : fixture.round >= 30
        ? 1.15
        : 1;
  const importanceLabel = node
    ? (node.label ??
      (node.round === finalRound
        ? 'Final'
        : node.round === finalRound - 1
          ? 'Semifinal'
          : 'Mata-mata'))
    : continental
      ? 'Internacional'
      : importance > 1
        ? 'Reta final do campeonato'
        : 'Rodada regular';
  const opponent = state.clubs.byId[fixture.awayId];
  const variation =
    ((Array.from(fixture.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 21) - 10) / 100;
  const appeal = clamp(0.85 + ((opponent?.leagueStrength ?? 80) - 50) / 200 + variation, 0.7, 1.4);
  const marketing = state.centers.byId[home?.trainingCenterId ?? '']?.levels.marketing ?? 1;
  const fairPriceCents = clamp(
    ceilMoney(
      GAMEPLAY.baseTicketCents *
        clamp((home?.leagueStrength ?? 60) / 65, 0.6, 1.5) *
        (1 + benefits.ticketPremium) *
        (0.9 + form * 0.2) *
        (0.9 + morale / 500) *
        appeal *
        importance *
        (1 + marketing * 0.02),
      MONEY_STEPS.ticket,
    ),
    10000,
    25000,
  );
  const priceCents = fixture.neutral
    ? GAMEPLAY.baseTicketCents
    : (priceOverride ??
      state.homeTicketPrices?.[fixture.homeId] ??
      state.ticketPrices?.[fixture.id] ??
      GAMEPLAY.baseTicketCents);
  const selloutPriceCents = TICKET_TIERS[0].priceCents;
  const minimumCrowdPriceCents = TICKET_TIERS[3].priceCents;
  const demandFactor = clamp(
    (0.85 + (morale / 100) * 0.1 + form * 0.1 + benefits.interest * 0.1) *
      (1 + (importance - 1) * 0.1) *
      (0.95 + (appeal - 1) * 0.1),
    0.85,
    1.08,
  );
  const commerce = benefits.commerce;
  const projection = projectTicketDemand(
    { capacity, selloutPriceCents, minimumCrowdPriceCents, commerce, demandFactor, fairPriceCents },
    priceCents,
  );
  return {
    capacity,
    commerce,
    demandFactor,
    ...projection,
    revenue:
      projection.ticketRevenue +
      roundMoney(projection.consumptionRevenue * (marketing >= 4 ? 1.2 : 1)),
    consumptionRevenue: roundMoney(projection.consumptionRevenue * (marketing >= 4 ? 1.2 : 1)),
    fairPriceCents,
    selloutPriceCents,
    minimumCrowdPriceCents,
    form,
    morale,
    importanceLabel,
  };
}

export function projectTicketDemand(
  parameters: {
    capacity: number;
    selloutPriceCents: number;
    minimumCrowdPriceCents: number;
    commerce: number;
    demandFactor?: number;
    fairPriceCents?: number;
  },
  rawPriceCents: number,
) {
  const { capacity, commerce } = parameters;
  const tiers = TICKET_TIERS;
  const tier = tiers.reduce(
    (best, item) =>
      Math.abs(item.priceCents - rawPriceCents) < Math.abs(best.priceCents - rawPriceCents)
        ? item
        : best,
    tiers[0]!,
  );
  const priceCents = tier.priceCents;
  const occupancy = clamp(tier.occupancy * (parameters.demandFactor ?? 1), 0.01, 1);
  const attendance = Math.floor(capacity * occupancy);
  // Larger stadiums retain an advantage with diminishing financial returns.
  const capacityYield = Math.min(1, Math.pow(7200 / Math.max(1, capacity), 0.8));
  // Ticket income is the paid admission price multiplied by attendance.
  const ticketRevenue = roundMoney(attendance * priceCents);
  const consumptionRevenue = ceilMoney(
    (attendance * GAMEPLAY.baseTicketCents * commerce * capacityYield) /
      GAMEPLAY.commerceRateDivisor /
      1000,
    5000,
  );
  return {
    priceCents,
    occupancy,
    attendance,
    ticketRevenue,
    consumptionRevenue,
    revenue: ticketRevenue + consumptionRevenue,
  };
}
/** Approximate three-way probabilities, independent of the seeded match outcome. */
export function matchProbabilities(state: WorldState, fixture: Fixture) {
  const strength = (clubId: string) => {
    const club = state.clubs.byId[clubId];
    if (!club) return 0;
    const entries = resolveLineup(state, club, fixture.scheduledAt);
    const plan = state.tactics[clubId];
    const opposing = state.tactics[clubId === fixture.homeId ? fixture.awayId : fixture.homeId];
    const bonus =
      lineupTacticalBonus(entries) +
      tacticalBonus(
        plan?.style ?? 'balanced',
        plan?.formation ?? '4-3-3',
        opposing?.style ?? 'balanced',
        opposing?.formation ?? '4-3-3',
        entries.flatMap((e) =>
          e.player ? [{ ...e.player, position: e.position, overall: e.effectiveOverall }] : [],
        ),
      );
    const selection = entries.flatMap((entry) =>
      entry.player
        ? [{ ...entry.player, overall: Math.min(99, entry.effectiveOverall + bonus) }]
        : [],
    );
    return balancedStrategy.strength(selection);
  };
  const baseHomeStrength = strength(fixture.homeId),
    awayStrength = strength(fixture.awayId);
  const demand = matchDemand(state, fixture);
  const advantage = fixture.neutral
    ? 0
    : GAMEPLAY.homeAdvantage +
      demand.occupancy *
        GAMEPLAY.cauldronBonus *
        Math.sqrt(demand.attendance / GAMEPLAY.referenceAttendance);
  const homeStrength = baseHomeStrength + advantage;
  const difference = homeStrength - awayStrength;
  const draw = Math.round(28 * Math.exp(-Math.abs(difference) / 55));
  const home = Math.round((100 - draw) / (1 + Math.exp(-difference / 18)));
  return {
    home,
    draw,
    away: 100 - home - draw,
    homeStrength,
    awayStrength,
    homeCrowdBonus: advantage,
    homeOccupancy: fixture.neutral ? 0 : demand.occupancy,
  };
}
