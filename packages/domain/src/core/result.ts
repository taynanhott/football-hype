import type { DomainError } from './domain-error.js';

export type Result<T, E = DomainError> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export function success<T>(value: T): Result<T, never> {
  return Object.freeze({ ok: true, value });
}

export function failure<E>(error: E): Result<never, E> {
  return Object.freeze({ ok: false, error });
}

export function mapResult<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? success(transform(result.value)) : result;
}

export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  transform: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? transform(result.value) : result;
}

type ResultValues<T> = {
  readonly [K in keyof T]: T[K] extends Result<infer V, DomainError> ? V : never;
};

export function combineResults<T extends Record<string, Result<unknown>>>(
  results: T,
): Result<ResultValues<T>> {
  const values: Array<readonly [string, unknown]> = [];
  for (const [key, result] of Object.entries(results)) {
    if (!result.ok) {
      return result;
    }
    values.push([key, result.value]);
  }
  return success(Object.freeze(Object.fromEntries(values)) as ResultValues<T>);
}
