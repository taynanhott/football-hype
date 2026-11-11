import { z } from 'zod';
import { entityIdSchema } from './primitives.js';
import { EUROPEAN_LEAGUES } from '../config/european-leagues.js';

/** Only ordered participants and completed score pairs are persisted. */
export const europeanLeaguesSchema = z.strictObject({
  season: z.number().int().nonnegative(),
  leagues: z
    .array(
      z.strictObject({
        competitionId: z.enum(EUROPEAN_LEAGUES.map((rule) => rule.id)),
        scheduleVersion: z.union([z.literal(1), z.literal(2)]),
        roundDates: z.array(z.number().finite()).length(38).optional(),
        clubIds: z
          .array(entityIdSchema)
          .length(20)
          .refine((ids) => new Set(ids).size === 20),
        scores: z
          .array(
            z
              .array(z.tuple([z.number().int().min(0).max(12), z.number().int().min(0).max(12)]))
              .length(10),
          )
          .max(38),
      }),
    )
    .max(5)
    .refine(
      (leagues) => new Set(leagues.map((league) => league.competitionId)).size === leagues.length,
      'Liga europeia duplicada',
    )
    .refine((leagues) => {
      const ids = leagues.flatMap((league) => league.clubIds);
      return new Set(ids).size === ids.length;
    }, 'Clube em mais de uma liga europeia'),
});
export type EuropeanLeagues = z.infer<typeof europeanLeaguesSchema>;
