import {
  MATCH_DURATION_MS,
  GAMEPLAY,
  roundMoney,
  type Fixture,
  type MatchResult,
  type PlayerSnapshot,
  type StadiumSnapshot,
  type PlayStyle,
} from '@football/shared';
import { hashSeed, mulberry32 } from './random.js';
import { spatialMatch } from './spatial-match.js';
import { completedMatchState } from '../multiplayer/machines.js';

export interface MatchStrategy {
  strength(players: readonly PlayerSnapshot[]): number;
}
export const balancedStrategy: MatchStrategy = {
  strength: (players) =>
    players.length
      ? players.reduce(
          (sum, player) =>
            sum +
            player.overall *
              (GAMEPLAY.fitnessBaseWeight + player.fitness / GAMEPLAY.fitnessScale) *
              (GAMEPLAY.moraleBaseWeight + player.morale / GAMEPLAY.moraleScale),
          0,
        ) / GAMEPLAY.lineupSize
      : 0,
};
export function simulateMatch(
  fixture: Fixture,
  home: readonly PlayerSnapshot[],
  away: readonly PlayerSnapshot[],
  stadium: StadiumSnapshot,
  seed: number,
  strategy: MatchStrategy = balancedStrategy,
  economics?: { attendance: number; occupancy: number; revenue: number; priceCents: number },
  styles?: { home: PlayStyle; away: PlayStyle },
): MatchResult {
  const matchSeed = hashSeed(seed, fixture.id);
  const random = mulberry32(matchSeed);
  const capacity = stadium.sectors.reduce((sum, sector) => sum + sector.capacity, 0);
  const morale = home.length
    ? home.reduce((sum, player) => sum + player.morale, 0) / home.length
    : 0;
  const upgrades =
    stadium.pitchLevel +
    stadium.surroundingsLevel +
    stadium.sectors.reduce((sum, sector) => sum + sector.level, 0);
  const occupancy =
    economics?.occupancy ??
    Math.min(
      1,
      GAMEPLAY.attendanceBase +
        (morale / 100) * GAMEPLAY.attendanceMoraleWeight +
        upgrades * GAMEPLAY.attendanceUpgradeWeight,
    );
  const attendance = economics?.attendance ?? Math.floor(capacity * occupancy);
  const advantage =
    GAMEPLAY.homeAdvantage +
    occupancy * GAMEPLAY.cauldronBonus * Math.sqrt(attendance / GAMEPLAY.referenceAttendance);
  const difference =
    strategy.strength(home) - strategy.strength(away) + (fixture.neutral ? 0 : advantage);
  const simulation = spatialMatch(home, away, random, difference, styles);
  const commerce =
    stadium.commerce.foodLevel + stadium.commerce.shirtsLevel + stadium.commerce.hospitalityLevel;
  return {
    fixtureId: fixture.id,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    stadiumId: stadium.id,
    durationMs: MATCH_DURATION_MS,
    ...simulation,
    status: completedMatchState(),
    attendance,
    ...(economics ? { ticketPriceCents: economics.priceCents } : {}),
    revenue:
      economics?.revenue ??
      roundMoney(
        attendance *
          GAMEPLAY.baseTicketCents *
          (1 + commerce / GAMEPLAY.commerceRateDivisor) *
          (1 + upgrades * GAMEPLAY.qualityTicketPremium),
      ),
    seed: matchSeed,
    scorers: simulation.scorers.sort((a, b) => a.minute - b.minute),
  };
}
