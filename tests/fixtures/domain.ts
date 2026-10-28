import type {
  ClubSnapshot,
  LeagueSnapshot,
  PlayerSnapshot,
  StadiumSnapshot,
  TrainingCenterSnapshot,
} from '../../packages/shared/src/index.js';
import type { Result } from '../../packages/domain/src/core/result.js';

export const IDS = Object.freeze({
  player: '00000000-0000-4000-8000-000000000001',
  secondPlayer: '00000000-0000-4000-8000-000000000002',
  club: '00000000-0000-4000-8000-000000000003',
  secondClub: '00000000-0000-4000-8000-000000000004',
  stadium: '00000000-0000-4000-8000-000000000005',
  trainingCenter: '00000000-0000-4000-8000-000000000006',
  league: '00000000-0000-4000-8000-000000000007',
  user: '00000000-0000-4000-8000-000000000008',
  secondUser: '00000000-0000-4000-8000-000000000009',
});

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Falha inesperada no teste: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function playerInput(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: IDS.player,
    name: 'Caio Aurora',
    nationality: 'BR',
    clubId: IDS.club,
    position: 'ST',
    shirtNumber: 9,
    age: 20,
    overall: 72,
    potential: 88,
    morale: 80,
    fitness: 95,
    appearances: 12,
    salary: { cents: 500_000, currency: 'BRL' },
    marketValue: { cents: 100_000_000, currency: 'BRL' },
    appearance: {
      skinTone: '#a87550',
      hairColor: '#211b18',
      hairStyle: 'curly',
      beardStyle: 'none',
    },
    ...overrides,
  };
}

export function clubInput(overrides: Partial<ClubSnapshot> = {}): ClubSnapshot {
  return {
    id: IDS.club,
    name: 'Aurora Futebol Clube',
    abbreviation: 'AUR',
    country: 'BR',
    division: 'A',
    balance: { cents: 500_000_000, currency: 'BRL' },
    playerIds: [IDS.player],
    stadiumId: IDS.stadium,
    trainingCenterId: IDS.trainingCenter,
    ...overrides,
  };
}

export function leagueInput(overrides: Partial<LeagueSnapshot> = {}): LeagueSnapshot {
  return {
    id: IDS.league,
    name: 'Liga Aurora',
    mode: 'offline',
    administratorId: IDS.user,
    season: 2026,
    clubIds: [IDS.club, IDS.secondClub],
    participants: [{ userId: IDS.user, clubId: IDS.club }],
    ...overrides,
  };
}

export function stadiumInput(overrides: Partial<StadiumSnapshot> = {}): StadiumSnapshot {
  return {
    id: IDS.stadium,
    clubId: IDS.club,
    name: 'Arena Aurora',
    pitchLevel: 1,
    surroundingsLevel: 1,
    sectors: [
      { id: 'north', level: 1, capacity: 5_000 },
      { id: 'south', level: 1, capacity: 5_000 },
      { id: 'east', level: 1, capacity: 8_000 },
      { id: 'west', level: 1, capacity: 7_000 },
    ],
    commerce: { foodLevel: 1, shirtsLevel: 1, hospitalityLevel: 1 },
    ...overrides,
  };
}

export function trainingCenterInput(
  overrides: Partial<TrainingCenterSnapshot> = {},
): TrainingCenterSnapshot {
  return {
    id: IDS.trainingCenter,
    clubId: IDS.club,
    levels: { fitness: 1, medical: 1, scouting: 1, coaching: 1, marketing: 1 },
    ...overrides,
  };
}
