import { z } from 'zod';
import { DOMAIN_LIMITS } from '../config/domain-limits.js';
import { clubCrestSchema } from './club-crest.js';
import {
  countryCodeSchema,
  divisionSchema,
  entityIdSchema,
  moneySchema,
  nameSchema,
  uniqueIdsSchema,
} from './primitives.js';

export const clubSchema = z
  .strictObject({
    id: entityIdSchema,
    name: nameSchema,
    coachName: nameSchema.optional(),
    kit: z
      .object({
        primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        tertiary: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        pattern: z.enum(['solid', 'stripes', 'hoops', 'sash']),
      })
      .optional(),
    crestUrl: z.url().optional(),
    crest: clubCrestSchema.optional(),
    abbreviation: z.string().trim().min(1).max(DOMAIN_LIMITS.abbreviationMaxLength),
    country: countryCodeSchema,
    division: divisionSchema,
    leagueStrength: z.number().int().min(1).max(100).optional(),
    balance: moneySchema,
    playerIds: uniqueIdsSchema,
    stadiumId: entityIdSchema,
    trainingCenterId: entityIdSchema,
  })
  .readonly();
