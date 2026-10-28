import { describe, expect, it, vi } from 'vitest';
import { HttpDataProvider } from '../src/repositories/http-data-provider.js';

describe('fronteira de dados externos', () => {
  it('valida o contrato e rejeita fontes indisponíveis ou incompatíveis', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    expect(
      (await new HttpDataProvider('https://example.test', 'private-token', request).load()).ok,
    ).toBe(false);
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer private-token' });
    request.mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await new HttpDataProvider('https://example.test', undefined, request).load()).ok).toBe(
      false,
    );
    request.mockRejectedValue(new Error('offline'));
    expect((await new HttpDataProvider('https://example.test', undefined, request).load()).ok).toBe(
      false,
    );
  });
});
