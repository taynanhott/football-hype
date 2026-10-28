import { overallSchema } from '@football/shared';
import { mapResult, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';

export class Overall {
  private constructor(private readonly amount: number) {
    Object.freeze(this);
  }

  get value(): number {
    return this.amount;
  }

  static create(input: unknown): Result<Overall> {
    return mapResult(parseBoundary(overallSchema, input), (value) => new Overall(value));
  }

  equals(other: Overall): boolean {
    return this.value === other.value;
  }

  toJSON(): number {
    return this.value;
  }
}
