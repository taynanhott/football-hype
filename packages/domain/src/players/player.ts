import { playerSchema, type PlayerSnapshot } from '@football/shared';
import { combineResults, flatMapResult, mapResult, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';
import { Age } from '../value-objects/age.js';
import { Overall } from '../value-objects/overall.js';
import { Morale } from '../value-objects/morale.js';
import { Money } from '../value-objects/money.js';
import { MarketValue } from '../value-objects/market-value.js';

export type Player = Readonly<
  Omit<PlayerSnapshot, 'age' | 'overall' | 'potential' | 'morale' | 'salary' | 'marketValue'> & {
    age: Age;
    overall: Overall;
    potential: Overall;
    morale: Morale;
    salary: Money;
    marketValue: MarketValue;
  }
>;

export function createPlayer(input: unknown): Result<Player> {
  return flatMapResult(parseBoundary(playerSchema, input), (snapshot) =>
    mapResult(
      combineResults({
        age: Age.create(snapshot.age),
        overall: Overall.create(snapshot.overall),
        potential: Overall.create(snapshot.potential),
        morale: Morale.create(snapshot.morale),
        salary: Money.create(snapshot.salary),
        marketValue: MarketValue.create(snapshot.marketValue),
      }),
      (values) => Object.freeze({ ...snapshot, ...values }),
    ),
  );
}

export function playerToSnapshot(player: Player): PlayerSnapshot {
  return Object.freeze({
    ...player,
    age: player.age.value,
    overall: player.overall.value,
    potential: player.potential.value,
    morale: player.morale.value,
    salary: player.salary.toJSON(),
    marketValue: player.marketValue.toJSON(),
  });
}
