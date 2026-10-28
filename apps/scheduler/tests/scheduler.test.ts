import { describe, it, expect, vi } from 'vitest';
import { runSeasonTick } from '../src/index.js';

describe('agendador Cloudflare', () => {
  it('chama o servidor com autenticação e sem seguir redirecionamentos', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await runSeasonTick({
      GAME_SERVER_URL: 'https://game.example',
      SCHEDULER_SECRET: 'test-secret',
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://game.example/internal/tick'),
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: 'Bearer test-secret' },
      }),
    );
  });
  it('reporta falhas para os registros do Worker', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      runSeasonTick({ GAME_SERVER_URL: 'https://game.example', SCHEDULER_SECRET: 'test-secret' }),
    ).rejects.toThrow('503');
  });
  it('recusa configurações sem HTTPS ou sem segredo', async () => {
    await expect(
      runSeasonTick({ GAME_SERVER_URL: 'http://game.example', SCHEDULER_SECRET: 'secret' }),
    ).rejects.toThrow('HTTPS');
    await expect(
      runSeasonTick({ GAME_SERVER_URL: 'https://game.example', SCHEDULER_SECRET: '' }),
    ).rejects.toThrow('HTTPS');
  });
});
