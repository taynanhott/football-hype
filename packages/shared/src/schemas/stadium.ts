import { z } from 'zod';
import { countSchema, entityIdSchema, facilityLevelSchema, nameSchema } from './primitives.js';

export const stadiumSectorIdSchema = z.enum(['north', 'south', 'east', 'west']);

export const stadiumSectorSchema = z
  .strictObject({
    id: stadiumSectorIdSchema,
    level: facilityLevelSchema,
    capacity: countSchema,
  })
  .readonly();

export const stadiumSchema = z
  .strictObject({
    id: entityIdSchema,
    clubId: entityIdSchema,
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    name: nameSchema,
    pitchLevel: facilityLevelSchema,
    surroundingsLevel: facilityLevelSchema,
    sectors: z.array(stadiumSectorSchema).length(stadiumSectorIdSchema.options.length).readonly(),
    commerce: z
      .strictObject({
        foodLevel: facilityLevelSchema,
        shirtsLevel: facilityLevelSchema,
        hospitalityLevel: facilityLevelSchema,
      })
      .readonly(),
  })
  .superRefine((stadium, context) => {
    if (new Set(stadium.sectors.map((sector) => sector.id)).size !== stadium.sectors.length) {
      context.addIssue({
        code: 'custom',
        path: ['sectors'],
        message: 'Setor de arquibancada duplicado',
      });
    }
    if (!Number.isSafeInteger(stadium.sectors.reduce((sum, sector) => sum + sector.capacity, 0))) {
      context.addIssue({
        code: 'custom',
        path: ['sectors'],
        message: 'Capacidade total excede o limite seguro',
      });
    }
  })
  .readonly();
