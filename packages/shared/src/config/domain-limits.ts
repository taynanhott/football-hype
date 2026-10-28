import { z } from 'zod';
import configuration from './domain-limits.json' with { type: 'json' };
export const MAX_SQUAD_SIZE = 45;

const rangeSchema = z
  .strictObject({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .refine((range) => range.max >= range.min, 'Intervalo inválido')
  .readonly();

export const domainLimitsSchema = z
  .strictObject({
    age: rangeSchema,
    overall: rangeSchema,
    morale: rangeSchema,
    fitness: rangeSchema,
    shirtNumber: rangeSchema,
    facilityLevel: rangeSchema,
    nameMaxLength: z.number().int().positive(),
    abbreviationMaxLength: z.number().int().positive(),
  })
  .readonly();

export const DOMAIN_LIMITS = domainLimitsSchema.parse(configuration);
