import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import { LeagueService } from '../../server/src/application/league-service.js';
import type { Identity } from '../../server/src/auth/identity.js';
import { DurableLeagueRepository } from './repository.js';
import { authenticate } from './auth.js';
import { datasetProvider } from './dataset.js';
import { nextLeagueWake } from './wake-policy.js';
import type { GameSnapshot } from '@football/shared';
import { UsageMeter } from './usage-meter.js';

export interface Env {
  GAME: DurableObjectNamespace<GameHub>;
  ASSETS: Fetcher;
  CLIENT_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PROJECT_NUMBER: string;
  USAGE_METRICS?: string;
}
type Session = {
  leagueId: string;
  identity: Identity;
  sessionId: string;
  expires: number;
  localTables?: boolean;
};
const messageSchema = z.object({ type: z.string().max(32), data: z.unknown().optional() });
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Falha inesperada';
}
export class GameHub extends DurableObject<Env> {
  private readonly repository: DurableLeagueRepository;
  private readonly service: LeagueService;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly meter: UsageMeter;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.meter = new UsageMeter(env.USAGE_METRICS === 'true');
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    const meter = this.meter;
    this.repository = new DurableLeagueRepository(
      {
        exec<T extends Record<string, string | number | null | ArrayBuffer>>(
          query: string,
          ...bindings: (string | number | null | ArrayBuffer)[]
        ): Iterable<T> {
          const cursor = ctx.storage.sql.exec<T>(query, ...bindings);
          meter.totals.sqlStatements++;
          meter.totals.rowsWritten += cursor.rowsWritten;
          return {
            *[Symbol.iterator]() {
              try {
                yield* cursor;
              } finally {
                meter.totals.rowsRead += cursor.rowsRead;
              }
            },
          };
        },
      },
      (fn) => ctx.storage.transactionSync(fn),
      false,
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
        if (session?.leagueId === id) this.queueSnapshot(ws, session);
      }
    });
  }
  private serial<T>(fn: () => Promise<T>, kind = 'operation'): Promise<T> {
    const current = this.pending
      .catch(() => undefined)
      .then(async () => {
        const before = this.meter.start();
        if (kind === 'http') this.meter.totals.httpRequests++;
        if (kind === 'websocket') this.meter.totals.webSocketMessages++;
        if (kind === 'alarm') this.meter.totals.alarms++;
        try {
          return await fn();
        } finally {
          this.meter.finish(kind, before, this.ctx.storage.sql.databaseSize);
        }
      });
    this.pending = current;
    return current;
  }
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname === '/socket' &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      const before = this.meter.start();
      this.meter.totals.httpRequests++;
      if (this.ctx.getWebSockets().length >= 100)
        return new Response('Sala cheia', { status: 429 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment(null);
      this.ctx.waitUntil(
        (async () => {
          const existing = await this.ctx.storage.getAlarm();
          const deadline = Date.now() + 20000;
          if (existing === null || existing > deadline) await this.ctx.storage.setAlarm(deadline);
        })(),
      );
      this.meter.finish('upgrade', before, this.ctx.storage.sql.databaseSize);
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
        this.meter.totals.errors++;
        return Response.json({ error: errorText(error) }, { status: 400 });
      }
    }, 'http');
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
      /^\/api\/leagues\/([0-9a-f-]+)\/(profile|preview|request|decide|leave|delete|reset|kick|players)$/.exec(
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
      case 'profile':
        await this.service.updateCoach(id, identity.userId, await body());
        break;
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
  private readonly dirtySockets = new Map<WebSocket, Session>();
  private readonly sent = new WeakMap<WebSocket, GameSnapshot>();
  private flushing = false;
  private queueSnapshot(ws: WebSocket, session: Session) {
    this.dirtySockets.set(ws, session);
    if (this.flushing) return;
    this.flushing = true;
    this.ctx.waitUntil(
      this.serial(async () => {
        try {
          const dirty = [...this.dirtySockets];
          this.dirtySockets.clear();
          for (const [socket, identity] of dirty) await this.snapshot(socket, identity);
        } finally {
          this.flushing = false;
          const remaining = this.dirtySockets.entries().next().value;
          if (remaining) this.queueSnapshot(remaining[0], remaining[1]);
        }
      }, 'snapshot'),
    );
  }
  private send(ws: WebSocket, type: string, data: unknown) {
    const payload = JSON.stringify({ type, data });
    this.meter.totals.sentMessages++;
    this.meter.totals.sentBytes += new TextEncoder().encode(payload).byteLength;
    if (type === 'snapshot') this.meter.totals.fullSnapshots++;
    if (type === 'snapshot-update') this.meter.totals.deltaSnapshots++;
    ws.send(payload);
  }
  private async snapshot(ws: WebSocket, session: Session) {
    try {
      const snapshot = await this.service.snapshot(
        session.leagueId,
        session.identity.userId,
        'cloudflare',
        !session.localTables,
      );
      const previous = this.sent.get(ws);
      if (previous) {
        const patch = Object.fromEntries(
          Object.entries(snapshot.state).filter(([key, value]) => {
            const old = previous.state[key as keyof typeof previous.state];
            return key === 'participants'
              ? JSON.stringify(old) !== JSON.stringify(value)
              : old !== value;
          }),
        );
        this.send(ws, 'snapshot-update', {
          leagueId: session.leagueId,
          baseRevision: previous.state.revision,
          revision: snapshot.state.revision,
          patch,
          tables: snapshot.tables,
          ledger: snapshot.ledger,
          serverTime: snapshot.serverTime,
          roomId: snapshot.roomId,
        });
      } else this.send(ws, 'snapshot', snapshot);
      this.sent.set(ws, snapshot);
    } catch {
      this.meter.totals.errors++;
      ws.close(1008, 'Participação encerrada');
    }
  }
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.serial(async () => {
      let requestId: string | undefined;
      try {
        this.meter.totals.receivedBytes +=
          typeof message === 'string'
            ? new TextEncoder().encode(message).byteLength
            : message.byteLength;
        if (typeof message !== 'string' || new TextEncoder().encode(message).length > 16384)
          throw new Error('Mensagem inválida');
        const { type, data } = messageSchema.parse(JSON.parse(message));
        let session = ws.deserializeAttachment() as Session | null;
        if (!session) {
          if (type !== 'auth') throw new Error('Autenticação obrigatória');
          const options = z
            .object({
              leagueId: z.uuid(),
              clubId: z.string().optional(),
              localTables: z.boolean().optional(),
            })
            .parse(data);
          const identity = await authenticate(
            data,
            this.env.FIREBASE_PROJECT_ID,
            this.env.FIREBASE_PROJECT_NUMBER,
          );
          await this.service.join(options.leagueId, identity, options.clubId);
          this.meter.totals.authentications++;
          session = {
            leagueId: options.leagueId,
            identity,
            sessionId: crypto.randomUUID(),
            expires: Date.now() + 55 * 60000,
            localTables: options.localTables ?? false,
          };
          ws.serializeAttachment(session);
          this.service.setOnline(session.leagueId, identity.userId, session.sessionId, true);
          this.send(ws, 'ready', {});
          this.queueSnapshot(ws, session);
        } else {
          if (Date.now() > session.expires) {
            ws.close(1008, 'Renove sua sessão');
            return;
          }
          if (type === 'command') {
            this.meter.totals.commands++;
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
            this.queueSnapshot(ws, session);
          } else if (type === 'sync') {
            this.sent.delete(ws);
            this.queueSnapshot(ws, session);
          } else if (type === 'heartbeat') this.send(ws, 'pong', {});
          else throw new Error('Mensagem desconhecida');
        }
        await this.schedule();
      } catch (error) {
        this.meter.totals.errors++;
        this.send(ws, 'error', { message: errorText(error), ...(requestId ? { requestId } : {}) });
        if (!ws.deserializeAttachment()) ws.close(1008, 'Autenticação inválida');
      }
    }, 'websocket');
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
    const now = Date.now();
    const deadlines: number[] = [];
    for (const id of await this.repository.active()) {
      const saved = await this.repository.load(id, { eventPatches: false });
      const at = saved && nextLeagueWake(saved.state, now);
      if (at !== undefined) deadlines.push(at);
    }
    for (const ws of this.ctx.getWebSockets()) {
      const session = ws.deserializeAttachment() as Session | null;
      if (session) deadlines.push(Math.max(now + 1000, session.expires));
      else deadlines.push(now + 20000);
    }
    const existing = await this.ctx.storage.getAlarm();
    if (deadlines.length) {
      const next = Math.min(...deadlines);
      if (existing !== next) {
        await this.ctx.storage.setAlarm(next);
        this.meter.totals.alarmWrites++;
      }
    } else if (existing !== null) await this.ctx.storage.deleteAlarm();
  }
  override async alarm(): Promise<void> {
    await this.serial(async () => {
      try {
        for (const ws of this.ctx.getWebSockets()) {
          const session = ws.deserializeAttachment() as Session | null;
          if (!session || session.expires <= Date.now()) ws.close(1008, 'Sessão expirada');
        }
        await this.service.tick();
      } finally {
        await this.schedule();
      }
    }, 'alarm');
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
