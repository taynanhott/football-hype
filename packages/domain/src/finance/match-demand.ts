import {
  GAMEPLAY,
  MONEY_STEPS,
  roundMoney,
  ceilMoney,
  type Fixture,
  type WorldState,
} from '@football/shared';
import { resolveLineup } from '../game/tactics.js';
import { balancedStrategy } from '../simulation/match.js';
import { scheduledFixtures } from '../competitions/fixtures.js';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function matchDemand(state: WorldState, fixture: Fixture, priceOverride?: number) {
  const home = state.clubs.byId[fixture.homeId];
  const stadium = state.stadiums.byId[fixture.stadiumId ?? home?.stadiumId ?? ''];
  const capacity = stadium?.sectors.reduce((sum, sector) => sum + sector.capacity, 0) ?? 0;
  const upgrades = stadium
    ? stadium.pitchLevel +
      stadium.surroundingsLevel +
      stadium.sectors.reduce((sum, sector) => sum + sector.level, 0)
    : 0;
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
      ? 'Competição continental'
      : importance > 1
        ? 'Reta final do campeonato'
        : 'Rodada regular';
  const marketing = state.centers.byId[home?.trainingCenterId ?? '']?.levels.marketing ?? 1;
  const fairPriceCents = roundMoney(
    GAMEPLAY.baseTicketCents *
      1.2 *
      (marketing >= 5 ? 1.3 : 1) *
      (1 + (importance - 1) * 1.5 + Math.min(0.3, upgrades * GAMEPLAY.qualityTicketPremium)),
    MONEY_STEPS.ticket,
  );
  const priceCents = Math.max(
    MONEY_STEPS.ticket,
    roundMoney(
      fixture.neutral
        ? GAMEPLAY.baseTicketCents
        : (priceOverride ??
            state.homeTicketPrices?.[fixture.homeId] ??
            state.ticketPrices?.[fixture.id] ??
            GAMEPLAY.baseTicketCents),
      MONEY_STEPS.ticket,
    ),
  );
  const interest =
    (GAMEPLAY.attendanceBase +
      (morale / 100) * GAMEPLAY.attendanceMoraleWeight +
      Math.min(0.2, upgrades * GAMEPLAY.attendanceUpgradeWeight)) *
    (marketing >= 5 ? 1.3 : 0.7 + form * 0.6) *
    (1 + (importance - 1) * 0.3);
  const selloutPriceCents =
    Math.floor(
      clamp(
        fairPriceCents * (1 + Math.log(Math.max(0.01, interest)) / 0.85),
        MONEY_STEPS.ticket,
        45000,
      ) / MONEY_STEPS.ticket,
    ) * MONEY_STEPS.ticket;
  const minimumCrowdPriceCents = Math.min(
    50000,
    ceilMoney(selloutPriceCents + (Math.log(100) * fairPriceCents) / 0.85, MONEY_STEPS.ticket),
  );
  const commerce = stadium
    ? stadium.commerce.foodLevel + stadium.commerce.shirtsLevel + stadium.commerce.hospitalityLevel
    : 0;
  const projection = projectTicketDemand(
    { capacity, selloutPriceCents, minimumCrowdPriceCents, commerce },
    priceCents,
  );
  return {
    capacity,
    commerce,
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
  },
  rawPriceCents: number,
) {
  const { capacity, selloutPriceCents, minimumCrowdPriceCents, commerce } = parameters;
  const priceCents = Math.max(MONEY_STEPS.ticket, roundMoney(rawPriceCents, MONEY_STEPS.ticket));
  const position = Math.max(
    0,
    Math.min(1, (priceCents - selloutPriceCents) / (minimumCrowdPriceCents - selloutPriceCents)),
  );
  const occupancy = position >= 1 ? 0.01 : Math.exp(-Math.log(100) * position);
  const attendance = Math.floor(capacity * occupancy);
  const ticketRevenue = roundMoney(attendance * priceCents);
  const consumptionRevenue = roundMoney(
    (attendance * GAMEPLAY.baseTicketCents * commerce) / GAMEPLAY.commerceRateDivisor,
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
    const selection = resolveLineup(state, club, fixture.scheduledAt).flatMap((entry) =>
      entry.player ? [{ ...entry.player, overall: entry.effectiveOverall }] : [],
    );
    return balancedStrategy.strength(selection);
  };
  const homeStrength = strength(fixture.homeId),
    awayStrength = strength(fixture.awayId);
  const demand = matchDemand(state, fixture);
  const advantage = fixture.neutral
    ? 0
    : GAMEPLAY.homeAdvantage +
      demand.occupancy *
        GAMEPLAY.cauldronBonus *
        Math.sqrt(demand.attendance / GAMEPLAY.referenceAttendance);
  const difference = homeStrength - awayStrength + advantage;
  const draw = Math.round(28 * Math.exp(-Math.abs(difference) / 55));
  const home = Math.round((100 - draw) / (1 + Math.exp(-difference / 18)));
  return { home, draw, away: 100 - home - draw, homeStrength, awayStrength };
}
