import { fileURLToPath } from 'node:url';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { z } from 'zod';
import { environment } from './config.js';
import { authenticate } from './auth/identity.js';
import { LeagueService } from './application/league-service.js';
import { LocalLeagueRepository } from './repositories/local-league-repository.js';
import { FirestoreLeagueRepository } from './repositories/firestore-league-repository.js';
import { leagueRoom } from './rooms/league-room.js';
import { FileDataProvider } from './repositories/file-data-provider.js';

const repository =
  environment.STORE === 'firestore'
    ? new FirestoreLeagueRepository()
    : new LocalLeagueRepository(environment.STORE === 'memory' ? undefined : environment.DATA_DIR);
if (repository instanceof LocalLeagueRepository) await repository.initialize();
const primaryData = environment.DATASET_FILE
  ? new FileDataProvider(environment.DATASET_FILE)
  : environment.NODE_ENV !== 'test'
    ? new FileDataProvider(
        fileURLToPath(new URL('../../../data/player-database.json', import.meta.url)),
      )
    : undefined;
const dataProvider = primaryData;
const service = new LeagueService(
  repository,
  environment.TEST_NOW ? () => Date.parse(environment.TEST_NOW ?? '') : Date.now,
  dataProvider,
);
const origins = new Set([
  environment.CLIENT_ORIGIN,
  ...(environment.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173']
    : []),
]);

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 16384) throw new Error('Solicitação muito grande');
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
function respond(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}
const http = createServer((request, response) => {
  void (async () => {
    const origin = request.headers.origin;
    if (origin && !origins.has(origin)) {
      respond(response, 403, { error: 'Origem não permitida' });
      return;
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Firebase-AppCheck, X-Guest-Id',
    );
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      respond(response, 200, {
        status: 'ok',
        persistence: environment.STORE,
        demo: environment.NODE_ENV !== 'production',
      });
      return;
    }
    if (url.pathname === '/internal/tick' && request.method === 'POST') {
      const provided = String(request.headers.authorization ?? '').replace(/^Bearer /, '');
      const secret = environment.SCHEDULER_SECRET;
      if (
        !secret ||
        Buffer.byteLength(provided) !== Buffer.byteLength(secret) ||
        !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
      ) {
        respond(response, 403, { error: 'Acesso negado' });
        return;
      }
      await service.tick();
      respond(response, 200, { ok: true });
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      respond(response, 404, { error: 'Não encontrado' });
      return;
    }
    if (url.pathname === '/api/catalog' && request.method === 'GET') {
      respond(response, 200, await service.catalog());
      return;
    }
    const identity = await authenticate({
      token: request.headers.authorization?.replace(/^Bearer /, ''),
      appCheckToken: request.headers['x-firebase-appcheck'],
      guestId: request.headers['x-guest-id'],
    });
    if (url.pathname === '/api/leagues' && request.method === 'POST') {
      respond(response, 201, { id: await service.create(identity, await body(request)) });
      return;
    }
    if (url.pathname === '/api/leagues' && request.method === 'GET') {
      respond(response, 200, await service.list(identity.userId));
      return;
    }
    const action = /^\/api\/leagues\/([0-9a-f-]+)\/(preview|request|decide|leave|delete)$/.exec(
      url.pathname,
    );
    if (action?.[1] && request.method === 'POST') {
      const id = action[1];
      if (action[2] === 'preview') {
        respond(response, 200, await service.invitation(id, await body(request)));
        return;
      }
      if (action[2] === 'request') await service.requestEntry(id, identity, await body(request));
      if (action[2] === 'decide') await service.decide(id, identity, await body(request));
      if (action[2] === 'leave' || action[2] === 'delete')
        await service.leave(id, identity.userId, action[2] === 'delete');
      respond(response, 200, { ok: true });
      return;
    }
    const match = /^\/api\/leagues\/([0-9a-f-]+)\/players$/.exec(url.pathname);
    if (match?.[1] && request.method === 'GET') {
      respond(
        response,
        200,
        await service.search(
          match[1],
          identity.userId,
          z
            .string()
            .max(100)
            .parse(url.searchParams.get('q') ?? ''),
        ),
      );
      return;
    }
    respond(response, 404, { error: 'Não encontrado' });
  })().catch((error: unknown) =>
    respond(response, 400, { error: error instanceof Error ? error.message : 'Falha inesperada' }),
  );
});
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: http,
    maxPayload: 16384,
    perMessageDeflate: {
      threshold: 1024,
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      zlibDeflateOptions: { level: 3 },
    },
  }),
  greet: false,
});
gameServer.define('league', leagueRoom(service)).filterBy(['leagueId']);
await gameServer.listen(environment.PORT, environment.HOST);
console.log(`Servidor de ligas em http://${environment.HOST}:${environment.PORT}`);
const timer = setInterval(() => {
  void service.tick().catch((error: unknown) => console.error('Falha no agendamento', error));
}, 30000);
timer.unref();
process.once('SIGTERM', () => {
  clearInterval(timer);
  void gameServer.gracefullyShutdown(false);
});
process.once('SIGINT', () => {
  clearInterval(timer);
  void gameServer.gracefullyShutdown(false);
});
