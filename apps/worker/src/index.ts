import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import { LeagueService } from '../../server/src/application/league-service.js';
import type { Identity } from '../../server/src/auth/identity.js';
import { DurableLeagueRepository } from './repository.js';
import { authenticate } from './auth.js';
import { datasetProvider } from './dataset.js';
import type { GameSnapshot } from '@football/shared';
import { UsageMeter } from './usage-meter.js';
import { encodeSnapshotMessage } from './snapshot-wire.js';
import {
  snapshotCacheSchema,
  snapshotManifest,
  stateChanges,
  type SnapshotCacheManifest,
} from '@football/shared';

export interface Env {
  GAME: DurableObjectNamespace<GameHubV2>;
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
  deltaProtocol?: boolean;
  cache?: SnapshotCacheManifest;
  sentSnapshot?: boolean;
  snapshotRevision?: number;
  compressedSnapshots?: boolean;
};
const messageSchema = z.object({ type: z.string().max(32), data: z.unknown().optional() });
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Falha inesperada';
}
export class GameHubV2 extends DurableObject<Env> {
  private readonly repository: DurableLeagueRepository;
  private readonly service: LeagueService;
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly commandSockets = new Set<WebSocket>();
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
        if (session?.leagueId === id && !this.commandSockets.has(ws))
          this.queueSnapshot(ws, session);
      }
    });
  }
  private serial<T>(fn: () => Promise<T>, kind = 'operation', lane = 'global'): Promise<T> {
    const queuedAt = performance.now();
    const current = (this.pending.get(lane) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const before = this.meter.start();
        const queueWaitMs = performance.now() - queuedAt;
        if (kind === 'http') this.meter.totals.httpRequests++;
        if (kind === 'websocket') this.meter.totals.webSocketMessages++;
        if (kind === 'alarm') this.meter.totals.alarms++;
        try {
          return await fn();
        } finally {
          this.meter.finish(kind, before, this.ctx.storage.sql.databaseSize, queueWaitMs);
        }
      });
    this.pending.set(lane, current);
    void current
      .finally(() => {
        if (this.pending.get(lane) === current) this.pending.delete(lane);
      })
      .catch(() => undefined);
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
      },
      this.env.FIREBASE_PROJECT_ID,
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
  private readonly prepared = new Map<
    string,
    { snapshot: GameSnapshot; payload: string | ArrayBuffer }
  >();
  private queueSnapshot(ws: WebSocket, session: Session) {
    this.dirtySockets.set(ws, session);
    if (this.flushing) return;
    this.flushing = true;
    this.ctx.waitUntil(
      this.serial(async () => {
        try {
          const dirty = [...this.dirtySockets];
          this.dirtySockets.clear();
          for (const [socket, identity] of dirty)
            // Compression yields to other events. Keep the entire delivery in
            // the command lane so another command cannot send a newer base
            // before this snapshot finishes and then overwrite `sent`.
            await this.serial(() => this.snapshot(socket, identity), 'snapshot', identity.leagueId);
        } finally {
          this.prepared.clear();
          this.flushing = false;
          const remaining = this.dirtySockets.entries().next().value;
          if (remaining) this.queueSnapshot(remaining[0], remaining[1]);
        }
      }, 'snapshot'),
    );
  }
  private send(ws: WebSocket, type: string, data: unknown) {
    if (ws.readyState === 2 || ws.readyState === 3) return;
    const payload = JSON.stringify({ type, data });
    this.meter.totals.sentMessages++;
    this.meter.totals.sentBytes += new TextEncoder().encode(payload).byteLength;
    if (type === 'snapshot') this.meter.totals.fullSnapshots++;
    if (type === 'snapshot-update' || type === 'snapshot-delta') this.meter.totals.deltaSnapshots++;
    ws.send(payload);
  }
  private async sendSnapshot(ws: WebSocket, session: Session, type: string, data: unknown) {
    if (ws.readyState === 2 || ws.readyState === 3) return;
    const payload = await encodeSnapshotMessage(type, data, session.compressedSnapshots === true);
    if (ws.readyState === 2 || ws.readyState === 3) return;
    this.meter.totals.sentMessages++;
    this.meter.totals.sentBytes +=
      typeof payload === 'string'
        ? new TextEncoder().encode(payload).byteLength
        : payload.byteLength;
    if (type === 'snapshot') this.meter.totals.fullSnapshots++;
    else this.meter.totals.deltaSnapshots++;
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
      if (
        previous?.state.revision === snapshot.state.revision &&
        JSON.stringify(previous.state.participants) === JSON.stringify(snapshot.state.participants)
      )
        return;
      const sharedKey =
        previous && session.deltaProtocol
          ? JSON.stringify([
              session.leagueId,
              previous.state.revision,
              snapshot.state.revision,
              previous.state.participants,
              snapshot.state.participants,
              session.localTables,
              session.compressedSnapshots,
            ])
          : undefined;
      const prepared = sharedKey ? this.prepared.get(sharedKey) : undefined;
      if (prepared) {
        if (ws.readyState !== 2 && ws.readyState !== 3) {
          ws.send(prepared.payload);
          this.meter.totals.sentMessages++;
          this.meter.totals.deltaSnapshots++;
          this.meter.totals.sentBytes +=
            typeof prepared.payload === 'string'
              ? new TextEncoder().encode(prepared.payload).byteLength
              : prepared.payload.byteLength;
          this.sent.set(ws, prepared.snapshot);
          session.snapshotRevision = prepared.snapshot.state.revision;
          session.sentSnapshot = true;
          ws.serializeAttachment(session);
        }
        return;
      }
      if (session.deltaProtocol && !previous && !session.cache && session.sentSnapshot) {
        this.send(ws, 'cache-request', {});
        return;
      }
      if (
        session.deltaProtocol &&
        (previous || (session.cache && session.cache.revision <= snapshot.state.revision))
      ) {
        let changes;
        if (previous) changes = stateChanges(previous.state, snapshot.state);
        else {
          const manifest = await snapshotManifest(snapshot, async (text) => {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join(
              '',
            );
          });
          changes = Object.entries(snapshot.state)
            .filter(([key]) => manifest.hashes[key] !== session.cache!.hashes[key])
            .map(([key, value]) => ({ path: [key], value }));
          for (const key of Object.keys(session.cache!.hashes))
            if (!Object.hasOwn(snapshot.state, key))
              changes.push({ path: [key], value: undefined });
        }
        const delta = {
          leagueId: session.leagueId,
          baseRevision: previous?.state.revision ?? session.cache!.revision,
          revision: snapshot.state.revision,
          changes,
          tables: snapshot.tables,
          ledger: snapshot.ledger,
          serverTime: snapshot.serverTime,
          roomId: snapshot.roomId,
        };
        if (sharedKey) {
          const payload = await encodeSnapshotMessage(
            'snapshot-delta',
            delta,
            session.compressedSnapshots === true,
          );
          this.prepared.set(sharedKey, { snapshot, payload });
          if (ws.readyState !== 2 && ws.readyState !== 3) {
            ws.send(payload);
            this.meter.totals.sentMessages++;
            this.meter.totals.deltaSnapshots++;
            this.meter.totals.sentBytes +=
              typeof payload === 'string'
                ? new TextEncoder().encode(payload).byteLength
                : payload.byteLength;
          }
        } else await this.sendSnapshot(ws, session, 'snapshot-delta', delta);
      } else if (previous) {
        const patch = Object.fromEntries(
          Object.entries(snapshot.state).filter(([key, value]) => {
            const old = previous.state[key as keyof typeof previous.state];
            return key === 'participants'
              ? JSON.stringify(old) !== JSON.stringify(value)
              : old !== value;
          }),
        );
        await this.sendSnapshot(ws, session, 'snapshot-update', {
          leagueId: session.leagueId,
          baseRevision: previous.state.revision,
          revision: snapshot.state.revision,
          patch,
          tables: snapshot.tables,
          ledger: snapshot.ledger,
          serverTime: snapshot.serverTime,
          roomId: snapshot.roomId,
        });
      } else await this.sendSnapshot(ws, session, 'snapshot', snapshot);
      delete session.cache;
      session.sentSnapshot = true;
      session.snapshotRevision = snapshot.state.revision;
      ws.serializeAttachment(session);
      this.sent.set(ws, snapshot);
    } catch (error) {
      this.meter.totals.errors++;
      console.error(JSON.stringify({ event: 'game.snapshot.failed', message: errorText(error) }));
      if (ws.readyState !== 2 && ws.readyState !== 3) {
        this.send(ws, 'error', {
          message: 'Não foi possível carregar a carreira. Seus dados salvos foram preservados.',
        });
        ws.close(errorText(error) === 'Acesso negado' ? 1008 : 1011, 'Falha ao carregar carreira');
      }
    }
  }
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.serial(
      async () => {
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
                deltaProtocol: z.boolean().optional(),
                compressedSnapshots: z.boolean().optional(),
                cache: snapshotCacheSchema.optional(),
              })
              .parse(data);
            const identity = await authenticate(data, this.env.FIREBASE_PROJECT_ID);
            await this.service.join(options.leagueId, identity, options.clubId);
            this.meter.totals.authentications++;
            session = {
              leagueId: options.leagueId,
              identity,
              sessionId: crypto.randomUUID(),
              expires: Date.now() + 55 * 60000,
              localTables: options.localTables ?? false,
              deltaProtocol: options.deltaProtocol ?? false,
              compressedSnapshots: options.compressedSnapshots ?? false,
              ...(options.cache ? { cache: options.cache } : {}),
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
              this.commandSockets.add(ws);
              this.meter.totals.commands++;
              const envelope = z.object({ requestId: z.uuid(), command: z.unknown() }).parse(data);
              requestId = envelope.requestId;
              // Hibernation drops the in-memory base. Before changing the world,
              // recover it only when it is exactly the revision sent to this socket.
              // A stale client still follows the normal cache/sync recovery path.
              if (
                session.deltaProtocol &&
                !this.sent.has(ws) &&
                session.snapshotRevision !== undefined
              ) {
                const base = await this.service.snapshot(
                  session.leagueId,
                  session.identity.userId,
                  'cloudflare',
                  !session.localTables,
                );
                if (base.state.revision === session.snapshotRevision) this.sent.set(ws, base);
              }
              const revision = await this.service.command(
                session.leagueId,
                session.identity.userId,
                envelope.command,
                false,
                requestId,
              );
              // Commit the SQLite write buffer before acknowledging or starting
              // snapshot preparation, so a reset cannot replay an unsaved advance.
              await this.ctx.storage.sync();
              this.send(ws, 'ack', { ok: true, requestId, revision });
              // Keep delivery in the command's lifetime instead of leaving the
              // sender waiting for an independent background flush after its ack.
              await this.snapshot(ws, session);
            } else if (type === 'cache-offer') {
              const manifest = snapshotCacheSchema.parse(data);
              if (!this.sent.has(ws)) {
                session.cache = manifest;
                this.queueSnapshot(ws, session);
              }
            } else if (type === 'resume') {
              this.send(ws, 'resumed', {});
              this.queueSnapshot(ws, session);
            } else if (type === 'sync') {
              delete session.cache;
              session.sentSnapshot = false;
              ws.serializeAttachment(session);
              this.sent.delete(ws);
              this.queueSnapshot(ws, session);
            } else if (type === 'heartbeat') this.send(ws, 'pong', {});
            else throw new Error('Mensagem desconhecida');
          }
          await this.schedule();
        } catch (error) {
          this.meter.totals.errors++;
          this.send(ws, 'error', {
            message: errorText(error),
            ...(requestId ? { requestId } : {}),
          });
          if (!ws.deserializeAttachment()) ws.close(1008, 'Autenticação inválida');
        } finally {
          this.commandSockets.delete(ws);
        }
      },
      'websocket',
      (ws.deserializeAttachment() as Session | null)?.leagueId ?? 'global',
    );
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
  private schedule() {
    return this.serial(() => this.updateSchedule(), 'schedule', 'scheduler');
  }
  private async updateSchedule() {
    const now = Date.now();
    const deadlines = await this.repository.wakeDeadlines(now);
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
