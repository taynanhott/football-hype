import type { ProxyOptions } from 'vite';

/** Local development keeps authentication and App Check on the hosted server. */
export function developmentGameProxy(
  target: string | undefined,
  origin: string | undefined,
): Record<string, ProxyOptions> | undefined {
  if (!target) return undefined;
  if (!origin) throw new Error('Configure DEV_GAME_SERVER_ORIGIN para o servidor publicado.');
  const upstream = new URL(target);
  const source = new URL(origin);
  if (
    upstream.protocol !== 'https:' &&
    !(
      upstream.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname)
    )
  )
    throw new Error('O servidor remoto de desenvolvimento deve usar HTTPS.');
  if (source.protocol !== 'https:')
    throw new Error('DEV_GAME_SERVER_ORIGIN deve ser o endereço HTTPS do site publicado.');
  return {
    '/__game': {
      target: upstream.origin,
      changeOrigin: true,
      ws: true,
      headers: { Origin: source.origin },
      rewrite: (path) => path.replace(/^\/__game(?=\/|$)/, '') || '/',
    },
  };
}
