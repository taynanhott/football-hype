import { ageSchema } from '@football/shared';
import { mapResult, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';

export class Age {
  private constructor(private readonly amount: number) {
    Object.freeze(this);
  }

  get value(): number {
    return this.amount;
  }

  static create(input: unknown): Result<Age> {
    return mapResult(parseBoundary(ageSchema, input), (value) => new Age(value));
  }

  equals(other: Age): boolean {
    return this.value === other.value;
  }

  toJSON(): number {
    return this.value;
  }
}
