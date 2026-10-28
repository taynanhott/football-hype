import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DOMAIN_LIMITS } from '@football/shared';
import { Age, MarketValue, Money, Morale, Overall } from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

describe.each([
  { name: 'Age', factory: Age.create, range: DOMAIN_LIMITS.age },
  { name: 'Overall', factory: Overall.create, range: DOMAIN_LIMITS.overall },
  { name: 'Morale', factory: Morale.create, range: DOMAIN_LIMITS.morale },
])('$name', ({ factory, range }) => {
  it('aceita inteiros nos limites configurados', () => {
    fc.assert(
      fc.property(fc.integer(range), (value) => {
        const result = factory(value);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe(value);
          expect(result.value.toJSON()).toBe(value);
          expect(Object.isFrozen(result.value)).toBe(true);
        }
      }),
    );
  });

  it.each([null, undefined, NaN, Infinity, -Infinity, '20', {}, [], 20.5])(
    'rejeita entrada inválida %j',
    (value) => {
      expect(factory(value)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    },
  );

  it('rejeita valores imediatamente fora do intervalo', () => {
    expect(factory(range.min - 1).ok).toBe(false);
    expect(factory(range.max + 1).ok).toBe(false);
  });
});

describe('igualdade dos objetos numéricos', () => {
  it('compara valores, independentemente da instância', () => {
    expect(unwrap(Age.create(20)).equals(unwrap(Age.create(20)))).toBe(true);
    expect(unwrap(Age.create(20)).equals(unwrap(Age.create(21)))).toBe(false);
    expect(unwrap(Overall.create(72)).equals(unwrap(Overall.create(72)))).toBe(true);
    expect(unwrap(Overall.create(72)).equals(unwrap(Overall.create(73)))).toBe(false);
    expect(unwrap(Morale.create(80)).equals(unwrap(Morale.create(80)))).toBe(true);
    expect(unwrap(Morale.create(80)).equals(unwrap(Morale.create(81)))).toBe(false);
  });
});

describe('Money', () => {
  const money = (cents: number, currency = 'BRL') => unwrap(Money.create({ cents, currency }));

  it('soma e subtrai centavos exatamente sem alterar os operandos', () => {
    fc.assert(
      fc.property(fc.nat({ max: 1_000_000_000 }), fc.nat({ max: 1_000_000_000 }), (left, right) => {
        const original = money(left);
        const addition = unwrap(original.add(money(right)));
        expect(addition.cents).toBe(left + right);
        expect(unwrap(addition.subtract(money(right))).equals(original)).toBe(true);
        expect(original.cents).toBe(left);
        expect(Object.isFrozen(addition)).toBe(true);
      }),
    );
  });

  it('preserva exatidão até o maior inteiro seguro', () => {
    const max = money(Number.MAX_SAFE_INTEGER);
    expect(unwrap(max.subtract(money(1))).cents).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(unwrap(max.add(money(0))).equals(max)).toBe(true);
    expect(max.add(money(1))).toMatchObject({ ok: false, error: { code: 'ARITHMETIC_OVERFLOW' } });
  });

  it('não permite saldo negativo', () => {
    expect(money(1).subtract(money(2))).toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(unwrap(money(100).subtract(money(100))).cents).toBe(0);
  });

  it('não mistura moedas', () => {
    const reais = money(100);
    const euros = money(100, 'EUR');
    expect(reais.add(euros)).toMatchObject({ ok: false, error: { code: 'CURRENCY_MISMATCH' } });
    expect(reais.subtract(euros)).toMatchObject({
      ok: false,
      error: { code: 'CURRENCY_MISMATCH' },
    });
    expect(reais.equals(euros)).toBe(false);
  });

  it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100'])(
    'rejeita centavos inválidos %j',
    (cents) => {
      expect(Money.create({ cents, currency: 'BRL' }).ok).toBe(false);
    },
  );

  it('rejeita moeda e campos desconhecidos', () => {
    expect(Money.create({ cents: 1, currency: 'XYZ' }).ok).toBe(false);
    expect(Money.create({ cents: 1, currency: 'BRL', injected: true }).ok).toBe(false);
  });

  it('serializa em formato JSON validável', () => {
    const original = money(12345);
    const restored = unwrap(Money.create(JSON.parse(JSON.stringify(original))));
    expect(restored.equals(original)).toBe(true);
    expect(Object.isFrozen(original.toJSON())).toBe(true);
  });
});

describe('MarketValue', () => {
  it('mantém moeda, centavos e igualdade por valor', () => {
    const first = unwrap(MarketValue.create({ cents: 100, currency: 'USD' }));
    const equal = unwrap(MarketValue.create(first.toJSON()));
    const different = unwrap(MarketValue.create({ cents: 101, currency: 'USD' }));
    expect(first.cents).toBe(100);
    expect(first.currency).toBe('USD');
    expect(first.equals(equal)).toBe(true);
    expect(first.equals(different)).toBe(false);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.money)).toBe(true);
    expect(MarketValue.create({ cents: -1, currency: 'BRL' }).ok).toBe(false);
  });
});
