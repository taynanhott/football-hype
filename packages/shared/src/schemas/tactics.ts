import { z } from 'zod';
import configuration from '../config/tactics.json' with { type: 'json' };
import { entityIdSchema } from './primitives.js';
import type { positionSchema } from './player.js';

export const TACTICS = z
  .object({
    chemistryMatches: z.number().int().positive(),
    chemistryBase: z.number().min(0).max(1),
    relatedPositionFactor: z.number().min(0).max(1),
    wrongPositionFactor: z.number().min(0).max(1),
    goalkeeperMismatchFactor: z.number().min(0).max(1),
    fatigueInjuryScale: z.number().nonnegative(),
    consecutiveInjuryScale: z.number().nonnegative(),
    shortRestInjuryScale: z.number().nonnegative(),
    safeRestHours: z.number().positive(),
    maximumInjuryChance: z.number().min(0).max(1),
  })
  .parse(configuration);
export const formationSchema = z.enum([
  '4-2-4',
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '4-3-1-2',
  '4-5-1',
  '4-1-4-1',
  '3-4-1-2',
]);
export type Formation = z.infer<typeof formationSchema>;
export type Position = z.infer<typeof positionSchema>;
const ROWS: Record<Formation, Position[][]> = {
  '4-2-4': [
    ['LB', 'CB', 'CB', 'RB'],
    ['CM', 'CM'],
    ['LW', 'ST', 'ST', 'RW'],
  ],
  '4-4-2': [
    ['LB', 'CB', 'CB', 'RB'],
    ['LM', 'CM', 'CM', 'RM'],
    ['ST', 'ST'],
  ],
  '4-3-3': [
    ['LB', 'CB', 'CB', 'RB'],
    ['CM', 'DM', 'CM'],
    ['LW', 'ST', 'RW'],
  ],
  '4-2-3-1': [['LB', 'CB', 'CB', 'RB'], ['DM', 'DM'], ['LM', 'AM', 'RM'], ['ST']],
  '3-5-2': [
    ['CB', 'CB', 'CB'],
    ['LM', 'CM', 'DM', 'CM', 'RM'],
    ['ST', 'ST'],
  ],
  '3-4-3': [
    ['CB', 'CB', 'CB'],
    ['LM', 'CM', 'CM', 'RM'],
    ['LW', 'ST', 'RW'],
  ],
  '5-3-2': [
    ['LB', 'CB', 'CB', 'CB', 'RB'],
    ['CM', 'DM', 'CM'],
    ['ST', 'ST'],
  ],
  '4-3-1-2': [['LB', 'CB', 'CB', 'RB'], ['CM', 'DM', 'CM'], ['AM'], ['ST', 'ST']],
  '4-5-1': [['LB', 'CB', 'CB', 'RB'], ['LM', 'CM', 'DM', 'CM', 'RM'], ['ST']],
  '4-1-4-1': [['LB', 'CB', 'CB', 'RB'], ['DM'], ['LM', 'CM', 'CM', 'RM'], ['ST']],
  '3-4-1-2': [['CB', 'CB', 'CB'], ['LM', 'CM', 'CM', 'RM'], ['AM'], ['ST', 'ST']],
};
export const FORMATIONS = Object.fromEntries(
  formationSchema.options.map((name) => [
    name,
    [
      { position: 'GK' as Position, x: 50, y: 91 },
      ...ROWS[name].flatMap((row, depth, rows) =>
        row.map((position, index) => ({
          position,
          x: ((index + 1) * 100) / (row.length + 1),
          y: 73 - (depth * 55) / (rows.length - 1),
        })),
      ),
    ],
  ]),
) as Record<Formation, Array<{ position: Position; x: number; y: number }>>;
export const playStyleSchema = z.enum([
  'balanced',
  'wings',
  'gegenpress',
  'low-block',
  'possession',
  'counter',
]);
export type PlayStyle = z.infer<typeof playStyleSchema>;
export const lineupSchema = z.strictObject({
  bench: z
    .array(entityIdSchema)
    .max(12)
    .refine((ids) => new Set(ids).size === ids.length, 'O banco contém atletas repetidos')
    .optional(),
  style: playStyleSchema.optional(),
  formation: formationSchema,
  starters: z
    .array(entityIdSchema)
    .length(11)
    .refine((ids) => new Set(ids).size === 11, 'A escalação contém atletas repetidos'),
});
export type Lineup = z.infer<typeof lineupSchema>;
export const lineupPresetSchema = z.strictObject({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(40),
  lineup: lineupSchema,
});
