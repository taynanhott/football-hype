import { expect, it } from 'vitest';
import { jsonObjectArray } from '../src/json-object-array';
it('preserva objetos, acentos, aspas e escapes em todas as divisões de blocos', () => {
  const value = [
    { text: 'São Paulo ⚽ } ], { " \\ \n', nested: [{ a: [1, null, true, false, { b: '"\\' }] }] },
    {},
    { amount: 123456789 },
  ];
  const json = JSON.stringify(value);
  for (let size = 1; size <= json.length; size++) {
    const chunks = Array.from({ length: Math.ceil(json.length / size) }, (_, i) =>
      json.slice(i * size, (i + 1) * size),
    );
    expect([...jsonObjectArray(chunks)]).toEqual(value);
  }
  expect([...jsonObjectArray([' \n[', ' ]\t'])]).toEqual([]);
});
it.each([
  '',
  '{}',
  '[1]',
  '[null]',
  '[,{}]',
  '[{},]',
  '[{}',
  '[{"a":1]',
  '[{}]x',
  '[{}{}]',
  '[{"a":"bad\\x"}]',
])('rejeita histórico corrompido: %s', (json) =>
  expect(() => [...jsonObjectArray([json])]).toThrow(),
);
