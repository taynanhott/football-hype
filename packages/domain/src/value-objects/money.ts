import { moneySchema, type Currency, type MoneySnapshot } from '@football/shared';
import { domainError } from '../core/domain-error.js';
import { failure, mapResult, success, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';

export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: Currency,
  ) {
    Object.freeze(this);
  }

  static create(input: unknown): Result<Money> {
    return mapResult(
      parseBoundary(moneySchema, input),
      (value) => new Money(value.cents, value.currency),
    );
  }

  add(other: Money): Result<Money> {
    if (this.currency !== other.currency) {
      return failure(domainError('CURRENCY_MISMATCH', 'Moedas diferentes'));
    }
    const cents = this.cents + other.cents;
    if (!Number.isSafeInteger(cents)) {
      return failure(domainError('ARITHMETIC_OVERFLOW', 'Valor excede o limite seguro'));
    }
    return success(new Money(cents, this.currency));
  }

  subtract(other: Money): Result<Money> {
    if (this.currency !== other.currency) {
      return failure(domainError('CURRENCY_MISMATCH', 'Moedas diferentes'));
    }
    if (other.cents > this.cents) {
      return failure(domainError('INSUFFICIENT_FUNDS', 'Saldo insuficiente'));
    }
    return success(new Money(this.cents - other.cents, this.currency));
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  toJSON(): MoneySnapshot {
    return Object.freeze({ cents: this.cents, currency: this.currency });
  }
}
