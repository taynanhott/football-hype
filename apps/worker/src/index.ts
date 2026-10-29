import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import { LeagueService } from '../../server/src/application/league-service.js';
import type { Identity } from '../../server/src/auth/identity.js';
import { DurableLeagueRepository } from './repository.js';
import { authenticate } from './auth.js';
import { datasetProvider } from './dataset.js';

export interface Env {
  GAME: DurableObjectNamespace<GameHub>;
  ASSETS: Fetcher;
  CLIENT_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PROJECT_NUMBER: string;
}
type Session = { leagueId: string; identity: Identity; sessionId: string; expires: number };
const messageSchema = z.object({ type: z.string().max(32), data: z.unknown().optional() });
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Falha inesperada';
}
export class GameHub extends DurableObject<Env> {
  private readonly repository: DurableLeagueRepository;
  private readonly service: LeagueService;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.repository = new DurableLeagueRepository(ctx.storage.sql, (fn) =>
      ctx.storage.transactionSync(fn),
    );
    this.service = new LeagueService(this.repository, Date.now, datasetProvider(env.ASSETS));
    for (const ws of ctx.getWebSockets()) {
      const session = ws.deserializeAttachment() as Session | null;
      if (session)
        this.service.setOnline(session.leagueId, session.identity.userId, session.sessionId, true);
    }
    this.service.updates.subscribe((id) => {
      for (const ws of this.ctx.getWebSockets()) {
        const session = ws.deserializeAttachment() as Session | null;
        if (session?.leagueId === id) this.ctx.waitUntil(this.snapshot(ws, session));
      }
    });
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const current = this.pending.catch(() => undefined).then(fn);
    this.pending = current;
    return current;
  }
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname === '/socket' &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      if (this.ctx.getWebSockets().length >= 100)
        return new Response('Sala cheia', { status: 429 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment(null);
      this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now() + 60000));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return this.serial(async () => {
      try {
        const started = performance.now();
        const value = await this.api(request, url);
        if (request.method === 'POST') await this.schedule();
        return Response.json(value, {
          headers: { 'Server-Timing': 'total;dur=' + (performance.now() - started).toFixed(1) },
        });
      } catch (error) {
        return Response.json({ error: errorText(error) }, { status: 400 });
      }
    });
  }
  private async api(request: Request, url: URL): Promise<unknown> {
    if (url.pathname === '/health')
      return { status: 'ok', persistence: 'durable-sqlite', demo: false };
    if (url.pathname === '/api/catalog' && request.method === 'GET') return this.service.catalog();
    if (!url.pathname.startsWith('/api/')) throw new Error('Não encontrado');
    const identity = await authenticate(
      {
        token: request.headers.get('Authorization')?.replace(/^Bearer /, ''),
        appCheckToken: request.headers.get('X-Firebase-AppCheck'),
      },
      this.env.FIREBASE_PROJECT_ID,
      this.env.FIREBASE_PROJECT_NUMBER,
    );
    const body = async () => {
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 16384)
        throw new Error('Solicitação muito grande');
      return JSON.parse(text) as unknown;
    };
    if (url.pathname === '/api/draw' && request.method === 'POST')
      return this.service.draw(identity, await body());
    if (url.pathname === '/api/leagues') {
      if (request.method === 'GET') return this.service.list(identity.userId);
      if (request.method === 'POST')
        return { id: await this.service.create(identity, await body()) };
    }
    const match =
      /^\/api\/leagues\/([0-9a-f-]+)\/(preview|request|decide|leave|delete|reset|kick|players)$/.exec(
        url.pathname,
      );
    if (!match?.[1]) throw new Error('Não encontrado');
    const id = match[1];
    if (match[2] === 'players' && request.method === 'GET')
      return this.service.search(
        id,
        identity.userId,
        z
          .string()
          .max(100)
          .parse(url.searchParams.get('q') ?? ''),
      );
    if (request.method !== 'POST') throw new Error('Método não permitido');
    switch (match[2]) {
      case 'preview':
        return this.service.invitation(id, await body(), identity.userId);
      case 'request':
        return (await this.service.requestEntry(id, identity, await body())) ?? { ok: true };
      case 'decide':
        await this.service.decide(id, identity, await body());
        break;
      case 'kick':
        await this.service.kick(id, identity.userId, await body());
        break;
      case 'reset':
        await this.service.reset(id, identity.userId);
        break;
      case 'leave':
      case 'delete':
        await this.service.leave(id, identity.userId, match[2] === 'delete');
        break;
      default:
        throw new Error('Não encontrado');
    }
    return { ok: true };
  }
  private send(ws: WebSocket, type: string, data: unknown) {
    ws.send(JSON.stringify({ type, data }));
  }
  private async snapshot(ws: WebSocket, session: Session) {
    try {
      this.send(
        ws,
        'snapshot',
        await this.service.snapshot(session.leagueId, session.identity.userId, 'cloudflare'),
      );
    } catch {
      ws.close(1008, 'Participação encerrada');
    }
  }
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.serial(async () => {
      let requestId: string | undefined;
      try {
        if (typeof message !== 'string' || new TextEncoder().encode(message).length > 16384)
          throw new Error('Mensagem inválida');
        const { type, data } = messageSchema.parse(JSON.parse(message));
        let session = ws.deserializeAttachment() as Session | null;
        if (!session) {
          if (type !== 'auth') throw new Error('Autenticação obrigatória');
          const options = z
            .object({ leagueId: z.uuid(), clubId: z.string().optional() })
            .parse(data);
          const identity = await authenticate(
            data,
            this.env.FIREBASE_PROJECT_ID,
            this.env.FIREBASE_PROJECT_NUMBER,
          );
          await this.service.join(options.leagueId, identity, options.clubId);
          session = {
            leagueId: options.leagueId,
            identity,
            sessionId: crypto.randomUUID(),
            expires: Date.now() + 55 * 60000,
          };
          ws.serializeAttachment(session);
          this.service.setOnline(session.leagueId, identity.userId, session.sessionId, true);
          this.send(ws, 'ready', {});
          await this.snapshot(ws, session);
        } else {
          if (Date.now() > session.expires) {
            ws.close(1008, 'Renove sua sessão');
            return;
          }
          if (type === 'command') {
            const envelope = z.object({ requestId: z.uuid(), command: z.unknown() }).parse(data);
            requestId = envelope.requestId;
            const revision = await this.service.command(
              session.leagueId,
              session.identity.userId,
              envelope.command,
              false,
              requestId,
            );
            this.send(ws, 'ack', { ok: true, requestId, revision });
            await this.snapshot(ws, session);
          } else if (type === 'sync') await this.snapshot(ws, session);
          else if (type === 'heartbeat')
            await this.service.touch(session.leagueId, session.identity.userId);
          else throw new Error('Mensagem desconhecida');
        }
        await this.schedule();
      } catch (error) {
        this.send(ws, 'error', { message: errorText(error), ...(requestId ? { requestId } : {}) });
        if (!ws.deserializeAttachment()) ws.close(1008, 'Autenticação inválida');
      }
    });
  }
  override async webSocketClose(ws: WebSocket): Promise<void> {
    const session = ws.deserializeAttachment() as Session | null;
    if (session)
      this.service.setOnline(session.leagueId, session.identity.userId, session.sessionId, false);
    ws.close();
  }
  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
  private async schedule() {
    if ((await this.repository.active()).length || this.ctx.getWebSockets().length) {
      const existing = await this.ctx.storage.getAlarm();
      if (!existing || existing <= Date.now() || existing > Date.now() + 60000)
        await this.ctx.storage.setAlarm(Date.now() + 60000);
    } else await this.ctx.storage.deleteAlarm();
  }
  override async alarm(): Promise<void> {
    await this.serial(async () => {
      try {
        for (const ws of this.ctx.getWebSockets()) {
          const session = ws.deserializeAttachment() as Session | null;
          if (!session || session.expires < Date.now()) ws.close(1008, 'Sessão expirada');
        }
        await this.service.tick();
      } finally {
        await this.schedule();
      }
    });
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.CLIENT_ORIGIN)
      return new Response('Origem não permitida', { status: 403 });
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': env.CLIENT_ORIGIN,
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          Vary: 'Origin',
        },
      });
    const response = await env.GAME.get(env.GAME.idFromName('football-hub-v1')).fetch(request);
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', env.CLIENT_ORIGIN);
    headers.set('Vary', 'Origin');
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
