import { describe, expect, it, vi } from 'vitest';
import {
  combineResults,
  domainError,
  failure,
  flatMapResult,
  mapResult,
  success,
} from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

describe('Result', () => {
  it('preserva chaves de resultados como propriedades próprias', () => {
    const combined = unwrap(combineResults(Object.fromEntries([['__proto__', success(1)]])));
    expect(Object.hasOwn(combined, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(combined)).toBe(Object.prototype);
    expect(combined['__proto__']).toBe(1);
  });
  it('encadeia operações bem-sucedidas', () => {
    expect(mapResult(success(2), (value) => value * 3)).toEqual(success(6));
    expect(flatMapResult(success(2), (value) => success(value + 3))).toEqual(success(5));
  });

  it('preserva falhas e não executa transformações', () => {
    const result = failure(domainError('INSUFFICIENT_FUNDS', 'Saldo insuficiente'));
    const transform = vi.fn(() => success(1));
    expect(mapResult(result, transform)).toBe(result);
    expect(flatMapResult(result, transform)).toBe(result);
    expect(transform).not.toHaveBeenCalled();
  });

  it('combina valores heterogêneos e propaga a primeira falha', () => {
    expect(unwrap(combineResults({ age: success(20), name: success('Caio') }))).toEqual({
      age: 20,
      name: 'Caio',
    });
    expect(unwrap(combineResults({}))).toEqual({});
    const failed = failure(domainError('VALIDATION_ERROR', 'Inválido'));
    expect(combineResults({ first: success(1), failed })).toBe(failed);
  });

  it('congela resultados e copia os detalhes de erro', () => {
    const issue = { path: 'age', message: 'Inválido' };
    const error = domainError('VALIDATION_ERROR', 'Inválido', [issue]);
    issue.message = 'Alterado';
    expect(error.issues[0]?.message).toBe('Inválido');
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(Object.isFrozen(error.issues[0])).toBe(true);
    expect(Object.isFrozen(success(1))).toBe(true);
    expect(Object.isFrozen(failure(error))).toBe(true);
  });
});
