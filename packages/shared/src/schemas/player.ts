import { roundMoney, MONEY_STEPS } from '../config/money-precision.js';
import { z } from 'zod';
import {
  ageSchema,
  countryCodeSchema,
  countSchema,
  entityIdSchema,
  fitnessSchema,
  gameMoneySchema,
  salaryMoneySchema,
  moraleSchema,
  nameSchema,
  overallSchema,
  shirtNumberSchema,
} from './primitives.js';

export const positionSchema = z.enum([
  'GK',
  'CB',
  'LB',
  'RB',
  'DM',
  'CM',
  'AM',
  'LW',
  'RW',
  'ST',
  'LM',
  'RM',
]);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const appearanceSchema = z
  .strictObject({
    skinTone: colorSchema,
    hairColor: colorSchema,
    hairStyle: z.enum(['bald', 'short', 'curly', 'long', 'braids']),
    beardStyle: z.enum(['none', 'stubble', 'full']),
  })
  .readonly();

export const playerSchema = z
  .strictObject({
    id: entityIdSchema,
    name: nameSchema,
    nationality: countryCodeSchema,
    clubId: entityIdSchema.nullable(),
    academyClubId: entityIdSchema.optional(),
    academyDismissedSeason: z.number().int().optional(),
    academySeason: z.number().int().optional(),
    academyPromotedSeason: z.number().int().optional(),
    position: positionSchema,
    shirtNumber: shirtNumberSchema,
    age: ageSchema,
    overall: overallSchema,
    potential: overallSchema,
    morale: moraleSchema,
    fitness: fitnessSchema,
    appearances: countSchema,
    salary: salaryMoneySchema,
    marketValue: gameMoneySchema,
    appearance: appearanceSchema,
  })
  .superRefine((player, context) => {
    if (player.overall > player.potential) {
      context.addIssue({
        code: 'custom',
        path: ['potential'],
        message: 'Potencial inferior ao overall atual',
      });
    }
  })
  .transform((player) =>
    player.marketValue.cents > 0
      ? player
      : {
          ...player,
          marketValue: {
            ...player.marketValue,
            cents: Math.max(
              MONEY_STEPS.general,
              roundMoney(
                Math.max(player.salary.cents * 36, Math.pow(player.overall / 60, 4) * 30000000) *
                  (player.age <= 23 ? 1.3 : player.age >= 32 ? 0.5 : 1),
              ),
            ),
          },
        },
  )
  .readonly();
