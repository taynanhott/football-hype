import { leagueSchema, type LeagueSnapshot } from '@football/shared';
import { parseBoundary } from '../core/validation.js';
import type { Result } from '../core/result.js';

export type League = LeagueSnapshot;

export function createLeague(input: unknown): Result<League> {
  return parseBoundary(leagueSchema, input);
}
