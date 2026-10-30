import { z } from 'zod';
import { entityIdSchema, facilityLevelSchema } from './primitives.js';

export const trainingCenterSchema = z
  .strictObject({
    id: entityIdSchema,
    clubId: entityIdSchema,
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    operations: z
      .object({
        cycleBonuses: z
          .record(z.string(), z.object({ games: z.number().int().min(0).max(15) }))
          .optional(),
        lastOfficialTrainingAt: z.record(z.string(), z.number()).optional(),
        trainingHistory: z
          .record(
            z.string(),
            z.object({
              season: z.number().int(),
              days: z.number().nonnegative(),
              growth: z.number().nonnegative(),
              bonus: z.number(),
              decline: z.number().nonnegative(),
            }),
          )
          .optional(),
        progression: z
          .record(
            z.string(),
            z.object({
              buff: z.number().int().min(0).max(3),
              buffProgress: z.number().min(0).max(1),
              declineProgress: z.number().min(0).max(1),
            }),
          )
          .optional(),
        playerLoads: z.record(z.string(), z.enum(['light', 'moderate', 'intense'])).optional(),
        effort: z.record(z.string(), z.number().nonnegative()).optional(),
        load: z.enum(['light', 'moderate', 'intense']).default('moderate'),
        fitness: z.array(z.string()).default([]),
        medical: z.array(z.string()).default([]),
        medicalProgress: z.record(z.string(), z.number()).optional(),
        individual: z
          .array(z.object({ playerId: z.string(), startedAt: z.number(), endsAt: z.number() }))
          .default([]),
        syringe: z.boolean().default(false),
        clearance: z.object({ playerId: z.string(), fixtureId: z.string() }).optional(),
      })
      .optional(),
    levels: z
      .strictObject({
        fitness: facilityLevelSchema,
        medical: facilityLevelSchema,
        scouting: facilityLevelSchema,
        coaching: facilityLevelSchema,
        marketing: facilityLevelSchema,
      })
      .readonly(),
  })
  .readonly();
