import { z } from 'zod';
import gameplay from '../config/gameplay.json' with { type: 'json' };
import competitions from '../config/competitions.json' with { type: 'json' };
import { divisionSchema, nameSchema } from './primitives.js';

const numericSettings = z.record(z.string(), z.number().finite().nonnegative());
const { timeZone, fifaWindows, ...numbers } = gameplay;
numericSettings.parse(numbers);
export const GAMEPLAY = Object.freeze({
  ...gameplay,
  timeZone: z.literal('America/Sao_Paulo').parse(timeZone),
  fifaWindows: z
    .array(z.strictObject({ start: z.iso.date(), end: z.iso.date() }))
    .parse(fifaWindows),
});

export const competitionRuleSchema = z
  .strictObject({
    id: z.string().min(1),
    name: nameSchema,
    format: z.enum(['league', 'knockout']),
    groupSize: z.number().int().min(4).max(6).optional(),
    groupCount: z.number().int().positive().optional(),
    groupMode: z.enum(['internal', 'paired', 'external']).optional(),
    advancement: z
      .enum(['top-two', 'sudamericana', 'mineiro', 'carioca', 'sul-sudeste', 'nordeste'])
      .optional(),
    finalLegs: z.union([z.literal(1), z.literal(2)]).optional(),
    firstKnockoutLegs: z.union([z.literal(1), z.literal(2)]).optional(),
    regulationUrl: z.url().optional(),
    groupLegs: z.union([z.literal(1), z.literal(2)]).optional(),
    division: divisionSchema.nullable(),
    teamCount: z.number().int().min(2),
    legs: z.union([z.literal(1), z.literal(2)]),
    promote: z.number().int().nonnegative(),
    relegate: z.number().int().nonnegative(),
    continental: z.number().int().nonnegative(),
    secondaryContinental: z.number().int().nonnegative(),
    tieBreakers: z
      .array(
        z.enum(['points', 'wins', 'goalDifference', 'goalsFor', 'redCards', 'yellowCards', 'id']),
      )
      .min(1)
      .readonly(),
  })
  .refine(
    (rule) => rule.promote + rule.relegate <= rule.teamCount,
    'Vagas excedem o total de clubes',
  )
  .readonly();
export const COMPETITIONS = z.array(competitionRuleSchema).readonly().parse(competitions);
export type CompetitionRule = z.infer<typeof competitionRuleSchema>;
