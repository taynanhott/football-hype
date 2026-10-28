import { afterEach, describe, expect, it } from 'vitest';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { developmentGameProxy } from '../dev/game-proxy';

let upstream: Server | undefined;
let vite: ViteDevServer | undefined;
const sockets = new Set<Duplex>();
afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await vite?.close();
  if (upstream) await new Promise<void>((resolve) => upstream!.close(() => resolve()));
  upstream = undefined;
  vite = undefined;
});

describe('interface local com a carreira online', () => {
  it('encaminha API e WebSocket preservando as credenciais e a origem configurada', async () => {
    const origin = 'https://game.example';
    let upgrade: { path: string | undefined; origin: string | undefined } | undefined;
    upstream = createHttpServer((request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          path: request.url,
          origin: request.headers.origin,
          token: request.headers.authorization,
          appCheck: request.headers['x-firebase-appcheck'],
        }),
      );
    });
    upstream.on('upgrade', (request, socket) => {
      sockets.add(socket);
      upgrade = { path: request.url, origin: request.headers.origin };
      const accept = createHash('sha1')
        .update(
          String(request.headers['sec-websocket-key']) + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
        )
        .digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
          accept +
          '\r\n\r\n',
      );
      socket.write(Buffer.concat([Buffer.from([0x81, 5]), Buffer.from('ready')]));
      socket.on('data', () => socket.end());
    });
    await new Promise<void>((resolve) => upstream!.listen(0, '127.0.0.1', resolve));
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Porta indisponível');
    vite = await createViteServer({
      configFile: false,
      appType: 'custom',
      logLevel: 'silent',
      server: {
        host: '127.0.0.1',
        port: 0,
        proxy: developmentGameProxy('http://127.0.0.1:' + address.port, origin),
      },
    });
    await vite.listen();
    const local = vite.httpServer!.address();
    if (!local || typeof local === 'string') throw new Error('Porta local indisponível');
    const response = await fetch(
      'http://127.0.0.1:' + local.port + '/__game/api/leagues?q=career',
      {
        headers: { Authorization: 'Bearer test-user', 'X-Firebase-AppCheck': 'test-attestation' },
      },
    );
    expect(await response.json()).toEqual({
      path: '/api/leagues?q=career',
      origin,
      token: 'Bearer test-user',
      appCheck: 'test-attestation',
    });
    const client = new WebSocket(
      'ws://127.0.0.1:' + local.port + '/__game/process/room?sessionId=test',
    );
    const message = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket sem resposta')), 5000);
      client.addEventListener(
        'message',
        (event) => {
          clearTimeout(timeout);
          resolve(String(event.data));
        },
        { once: true },
      );
      client.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket recusado'));
        },
        { once: true },
      );
    });
    client.close();
    expect(message).toBe('ready');
    expect(upgrade).toEqual({ path: '/process/room?sessionId=test', origin });
  });
  it('exige HTTPS para destinos remotos e não cria proxy sem configuração', () => {
    expect(developmentGameProxy(undefined, undefined)).toBeUndefined();
    expect(() => developmentGameProxy('http://remote.example', 'https://game.example')).toThrow(
      'HTTPS',
    );
    expect(() => developmentGameProxy('https://remote.example', undefined)).toThrow(
      'DEV_GAME_SERVER_ORIGIN',
    );
  });
});
