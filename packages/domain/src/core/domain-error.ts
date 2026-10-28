export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'CURRENCY_MISMATCH'
  | 'INSUFFICIENT_FUNDS'
  | 'ARITHMETIC_OVERFLOW'
  | 'DUPLICATE_ENTITY'
  | 'ENTITY_NOT_FOUND';

export type ValidationIssue = Readonly<{ path: string; message: string }>;
export type DomainError = Readonly<{
  code: DomainErrorCode;
  message: string;
  issues: readonly ValidationIssue[];
}>;

export function domainError(
  code: DomainErrorCode,
  message: string,
  issues: readonly ValidationIssue[] = [],
): DomainError {
  return Object.freeze({
    code,
    message,
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
  });
}
