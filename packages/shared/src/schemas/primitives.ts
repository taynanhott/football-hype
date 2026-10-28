import { z } from 'zod';
import { DOMAIN_LIMITS } from '../config/domain-limits.js';
import { MONEY_STEPS, roundMoney } from '../config/money-precision.js';

const integerRange = (range: Readonly<{ min: number; max: number }>) =>
  z.number().int().min(range.min).max(range.max);

export const entityIdSchema = z.uuid();
export const userIdSchema = z.string().min(1).max(128).regex(/^\S+$/);
export const nameSchema = z.string().trim().min(1).max(DOMAIN_LIMITS.nameMaxLength);
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
export const currencySchema = z.enum(['BRL', 'USD', 'EUR']);
export const ageSchema = integerRange(DOMAIN_LIMITS.age);
export const overallSchema = integerRange(DOMAIN_LIMITS.overall);
export const moraleSchema = integerRange(DOMAIN_LIMITS.morale);
export const fitnessSchema = integerRange(DOMAIN_LIMITS.fitness);
export const shirtNumberSchema = integerRange(DOMAIN_LIMITS.shirtNumber);
export const facilityLevelSchema = integerRange(DOMAIN_LIMITS.facilityLevel);
export const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const moneySchema = z
  .strictObject({ cents: countSchema, currency: currencySchema })
  .readonly();
export const gameAmountSchema = countSchema.transform((value) => roundMoney(value));
export const salaryAmountSchema = countSchema.transform((value) =>
  roundMoney(value, MONEY_STEPS.salary),
);
export const ticketAmountSchema = z
  .number()
  .int()
  .min(500)
  .max(50000)
  .transform((value) => Math.max(MONEY_STEPS.ticket, roundMoney(value, MONEY_STEPS.ticket)));
export const gameMoneySchema = z
  .strictObject({ cents: gameAmountSchema, currency: currencySchema })
  .readonly();
export const salaryMoneySchema = z
  .strictObject({ cents: salaryAmountSchema, currency: currencySchema })
  .readonly();
export const divisionSchema = z.enum(['A', 'B', 'C', 'D', 'REGIONAL']);
export const uniqueIdsSchema = z
  .array(entityIdSchema)
  .refine((ids) => new Set(ids).size === ids.length, 'Identificadores duplicados')
  .readonly();
