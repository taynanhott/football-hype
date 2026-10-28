import {
  GAMEPLAY,
  type ClubSnapshot,
  type PlayerSnapshot,
  type TrainingCenterSnapshot,
} from '@football/shared';

const divisionPower = Object.freeze({ A: 4, B: 3, C: 2, D: 1, REGIONAL: 1 });
export const BRAZIL_LEAGUE_STRENGTH = Object.freeze({ A: 80, B: 65, C: 50, D: 35, REGIONAL: 35 });
export interface InterestStrategy {
  calculate(
    player: PlayerSnapshot,
    buyer: ClubSnapshot,
    seller: ClubSnapshot | undefined,
    center: TrainingCenterSnapshot,
    squadStrength: number,
  ): number;
}
export class ContextualInterest implements InterestStrategy {
  calculate(
    player: PlayerSnapshot,
    buyer: ClubSnapshot,
    seller: ClubSnapshot | undefined,
    center: TrainingCenterSnapshot,
    squadStrength: number,
  ): number {
    const divisionGap =
      divisionPower[buyer.division] -
      (seller?.country === 'BR' ? divisionPower[seller.division] : 4);
    const score =
      GAMEPLAY.interestBase +
      ((buyer.leagueStrength ?? squadStrength) - (seller?.leagueStrength ?? 90)) *
        GAMEPLAY.interestLeagueWeight +
      (squadStrength - player.overall) * GAMEPLAY.interestStrengthWeight +
      divisionGap * GAMEPLAY.interestDivisionWeight +
      (center.levels.scouting + center.levels.coaching) * GAMEPLAY.interestFacilityWeight +
      (player.age - GAMEPLAY.youthMaxAge) * GAMEPLAY.interestAgeWeight;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
