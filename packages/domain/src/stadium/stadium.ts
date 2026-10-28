import { stadiumSchema, type StadiumSnapshot } from '@football/shared';
import { parseBoundary } from '../core/validation.js';
import type { Result } from '../core/result.js';

export type Stadium = StadiumSnapshot;

export function createStadium(input: unknown): Result<Stadium> {
  return parseBoundary(stadiumSchema, input);
}

export function stadiumCapacity(stadium: Stadium): number {
  return stadium.sectors.reduce((capacity, sector) => capacity + sector.capacity, 0);
}
