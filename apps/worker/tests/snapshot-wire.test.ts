import { expect, it, vi } from 'vitest';
import { encodeSnapshotMessage } from '../src/snapshot-wire';
import { decodeSnapshotMessage } from '../../client/src/store/snapshot-wire';

it('compacta histórico por partes e preserva acentos, caracteres e valores financeiros', async () => {
  const data = {
    state: {
      history: Array.from({ length: 6000 }, (_, index) => ({
        name: 'São Paulo ⚽',
        cents: 123456789 + index,
        coordinates: Array.from({ length: 44 }, (_, offset) => index + offset),
        optional: undefined,
      })),
    },
  };
  const expected = JSON.stringify({ type: 'snapshot', data });
  const stringify = vi.spyOn(JSON, 'stringify');
  try {
    const encoded = await encodeSnapshotMessage('snapshot', data, true);
    expect(stringify.mock.calls.some(([value]) => value?.data === data)).toBe(false);
    expect(await decodeSnapshotMessage(encoded)).toBe(expected);
  } finally {
    stringify.mockRestore();
  }
});

it('transfere uma carreira acima de 32 MB compactada sem perder conteúdo', async () => {
  const data = {
    name: 'São Januário ⚽',
    revision: 123,
    history: 'partida: Flamengo × São Paulo; receita: 1.234,5 K\n'.repeat(750000),
  };
  const expected = JSON.stringify({ type: 'snapshot', data });
  expect(new TextEncoder().encode(expected).byteLength).toBeGreaterThan(33554432);
  const encoded = await encodeSnapshotMessage('snapshot', data, true);
  expect(encoded).toBeInstanceOf(ArrayBuffer);
  expect((encoded as ArrayBuffer).byteLength).toBeLessThan(1000000);
  expect(await decodeSnapshotMessage(encoded)).toBe(expected);
});
it('preserva JSON para clientes anteriores e para mensagens pequenas', async () => {
  for (const compressed of [true, false]) {
    const message = await encodeSnapshotMessage('snapshot-delta', { revision: 2 }, compressed);
    expect(typeof message).toBe('string');
    expect(JSON.parse(await decodeSnapshotMessage(message))).toEqual({
      type: 'snapshot-delta',
      data: { revision: 2 },
    });
  }
  const message = await encodeSnapshotMessage('snapshot', { text: 'x'.repeat(140000) }, false);
  expect(typeof message).toBe('string');
});
