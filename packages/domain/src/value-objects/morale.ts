import { moraleSchema } from '@football/shared';
import { mapResult, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';

export class Morale {
  private constructor(private readonly amount: number) {
    Object.freeze(this);
  }

  get value(): number {
    return this.amount;
  }

  static create(input: unknown): Result<Morale> {
    return mapResult(parseBoundary(moraleSchema, input), (value) => new Morale(value));
  }

  equals(other: Morale): boolean {
    return this.value === other.value;
  }

  toJSON(): number {
    return this.value;
  }
}
