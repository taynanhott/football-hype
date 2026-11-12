import {
  clubSchema,
  researchedClubCoachName,
  type ClubSnapshot,
  type WorldState,
} from '@football/shared';
import { flatMapResult, mapResult, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';
import { Money } from '../value-objects/money.js';

export type Club = Readonly<Omit<ClubSnapshot, 'balance'> & { balance: Money }>;

export function createClub(input: unknown): Result<Club> {
  return flatMapResult(parseBoundary(clubSchema, input), (snapshot) =>
    mapResult(Money.create(snapshot.balance), (balance) => Object.freeze({ ...snapshot, balance })),
  );
}

export function clubToSnapshot(club: Club): ClubSnapshot {
  return Object.freeze({ ...club, balance: club.balance.toJSON() });
}

/** A participant's coach profile takes precedence over the club's real-world coach. */
export function clubCoachName(state: Pick<WorldState, 'participants'>, club: ClubSnapshot): string {
  const participant = state.participants.find((member) => member.clubId === club.id);
  if (participant) return participant.coach?.name?.trim() || 'Treinador';
  const savedName = club.coachName?.trim();
  if (savedName && !/^(?:Treinador|Técnico)(?:\s+(?:do|da|de)\s+.+)?$/i.test(savedName))
    return savedName;
  return researchedClubCoachName(club.name) || savedName || `Treinador do ${club.name}`;
}
