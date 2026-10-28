import type { Currency, MoneySnapshot } from '@football/shared';
import { mapResult, type Result } from '../core/result.js';
import { Money } from './money.js';

export class MarketValue {
  private constructor(readonly money: Money) {
    Object.freeze(this);
  }

  static create(input: unknown): Result<MarketValue> {
    return mapResult(Money.create(input), (money) => new MarketValue(money));
  }

  get cents(): number {
    return this.money.cents;
  }

  get currency(): Currency {
    return this.money.currency;
  }

  equals(other: MarketValue): boolean {
    return this.money.equals(other.money);
  }

  toJSON(): MoneySnapshot {
    return this.money.toJSON();
  }
}
