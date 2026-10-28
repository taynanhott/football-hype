import { clubSchema, type ClubSnapshot } from '@football/shared';
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
