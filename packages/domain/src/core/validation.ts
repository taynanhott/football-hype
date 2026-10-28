import type { z } from 'zod';
import { domainError } from './domain-error.js';
import { failure, success, type Result } from './result.js';

export function parseBoundary<T>(schema: z.ZodType<T>, input: unknown): Result<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return success(result.data);
  }
  return failure(
    domainError(
      'VALIDATION_ERROR',
      'Dados de domínio inválidos',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    ),
  );
}
