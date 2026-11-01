import { describe, it, vi, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createWorld } from '@football/domain';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  snapshotManifest,
  applyStateChanges,
  snapshotDeltaSchema,
  type GameSnapshot,
} from '@football/shared';
import type { LeagueService } from '../../server/src/application/league-service.js';
import type { DurableLeagueRepository } from '../src/repository.js';
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      protected ctx: unknown,
      protected env: unknown,
    ) {}
  },
}));
vi.mock('../src/auth.js', () => ({
  authenticate: async (input: { token: string }) => ({
    userId: input.token,
    name: 'Treinador',
    guest: false,
  }),
}));
vi.mock('../src/dataset.js', () => ({ datasetProvider: () => undefined }));

describe('sincronização do Worker com dez conexões', () => {
  it('envia um estado por ação, recupera sync completo e persiste comandos de mercado sem duplicar', async () => {
    const modulePath = '../src/index.js';
    const { GameHubV2 } = await import(modulePath);
    const db = new DatabaseSync(':memory:');
    const sockets: ReturnType<typeof socket>[] = [];
    const tasks: Promise<unknown>[] = [];
    let alarm: number | null = null;
    function socket() {
      let attachment: unknown = null;
      const messages: {
        type: string;
        data: { patch: Record<string, unknown>; tables: Record<string, unknown> };
      }[] = [];
      return {
        serializeAttachment(value: unknown) {
          attachment = value;
        },
        deserializeAttachment() {
          return attachment;
        },
        send(payload: string) {
          messages.push(JSON.parse(payload));
        },
        close: vi.fn(),
        messages,
      };
    }
    vi.stubGlobal(
      'WebSocketRequestResponsePair',
      class {
        constructor(
          public request: string,
          public response: string,
        ) {}
      },
    );
    const auto = vi.fn();
    const context = {
      getWebSockets: () => sockets,
      setWebSocketAutoResponse: auto,
      waitUntil: (p: Promise<unknown>) => tasks.push(p),
      storage: {
        sql: {
          exec(query: string, ...bindings: (string | number | null)[]) {
            const before = Number(db.prepare('SELECT total_changes() AS n').get()!.n);
            const rows = db.prepare(query).all(...bindings);
            return Object.assign(rows, {
              rowsRead: rows.length,
              rowsWritten: Number(db.prepare('SELECT total_changes() AS n').get()!.n) - before,
            });
          },
        },
        transactionSync<T>(fn: () => T) {
          db.exec('BEGIN');
          try {
            const result = fn();
            db.exec('COMMIT');
            return result;
          } catch (e) {
            db.exec('ROLLBACK');
            throw e;
          }
        },
        getAlarm: async () => alarm,
        setAlarm: async (at: number) => {
          alarm = at;
        },
        deleteAlarm: async () => {
          alarm = null;
        },
      },
    };
    const usageLogs: Record<string, number>[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message: string) => {
      try {
        const value = JSON.parse(message);
        if (value.event === 'game.usage') usageLogs.push(value);
      } catch {
        /* Other test output is irrelevant to this meter. */
      }
    });
    const hub = new GameHubV2(context as never, { USAGE_METRICS: 'true' } as never);
    const repo = (hub as unknown as { repository: DurableLeagueRepository }).repository;
    const created = createWorld({
      id: randomUUID(),
      userId: 'coach-0',
      name: 'Sincronização',
      mode: 'multiplayer',
      now: Date.now(),
    });
    if (!created.ok) throw new Error('world');
    await repo.create({
      ...created.value,
      inviteCode: randomUUID(),
      participants: created.value.clubs.ids.slice(0, 10).map((clubId, i) => ({
        userId: `coach-${i}`,
        clubId,
        ready: false,
        lastSeenAt: Date.now(),
      })),
    });
    async function drain() {
      while (tasks.length) await Promise.all(tasks.splice(0));
    }
    try {
      for (let i = 0; i < 10; i++) {
        const ws = socket();
        sockets.push(ws);
        await hub.webSocketMessage(
          ws as never,
          JSON.stringify({
            type: 'auth',
            data: { token: `coach-${i}`, leagueId: created.value.id, localTables: i !== 9 },
          }),
        );
        await drain();
        expect(ws.messages.filter((m) => m.type === 'snapshot')).toHaveLength(1);
      }
      for (const ws of sockets) ws.messages.length = 0;
      const id = randomUUID();
      await hub.webSocketMessage(
        sockets[0] as never,
        JSON.stringify({
          type: 'command',
          data: { requestId: id, command: { type: 'home-ticket-price', priceCents: 20000 } },
        }),
      );
      await drain();
      for (const [index, ws] of sockets.entries()) {
        const updates = ws.messages.filter((m) => m.type === 'snapshot-update');
        expect(updates).toHaveLength(1);
        expect(updates[0]!.data.patch.players).toBeUndefined();
        if (index === 9) expect(Object.keys(updates[0]!.data.tables).length).toBeGreaterThan(0);
        else expect(updates[0]!.data.tables).toEqual({});
      }
      const revision = (await repo.load(created.value.id))!.state.revision;
      await hub.webSocketMessage(
        sockets[0] as never,
        JSON.stringify({
          type: 'command',
          data: { requestId: id, command: { type: 'home-ticket-price', priceCents: 20000 } },
        }),
      );
      await drain();
      expect((await repo.load(created.value.id))!.state.revision).toBe(revision);
      sockets[0]!.messages.length = 0;
      await hub.webSocketMessage(sockets[0] as never, JSON.stringify({ type: 'sync' }));
      await drain();
      expect(sockets[0]!.messages.filter((m) => m.type === 'snapshot')).toHaveLength(1);
      expect(auto).toHaveBeenCalledOnce();
      expect(alarm).not.toBeNull();
      const service = (hub as unknown as { service: LeagueService }).service;
      const cached = await service.snapshot(created.value.id, 'coach-0', 'cloudflare', false);
      const manifest = await snapshotManifest(cached, async (text) => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
      });
      await service.command(
        created.value.id,
        'coach-0',
        { type: 'home-ticket-price', priceCents: 10000 },
        false,
        randomUUID(),
      );
      await drain();
      const resumed = socket();
      sockets.push(resumed);
      await hub.webSocketMessage(
        resumed as never,
        JSON.stringify({
          type: 'auth',
          data: {
            token: 'coach-0',
            leagueId: created.value.id,
            localTables: true,
            deltaProtocol: true,
            cache: manifest,
          },
        }),
      );
      await drain();
      expect(resumed.messages.filter((m) => m.type === 'snapshot')).toHaveLength(0);
      const payload = resumed.messages.find((m) => m.type === 'snapshot-delta')!.data;
      const delta = snapshotDeltaSchema.parse(payload);
      expect(delta.changes.some((c) => c.path[0] === 'players')).toBe(false);
      const recovered = applyStateChanges(cached.state, delta.changes);
      expect(recovered).toEqual(
        (await service.snapshot(created.value.id, 'coach-0', 'cloudflare', false)).state,
      );
      const resumeBytes = Buffer.byteLength(JSON.stringify(payload));
      expect(resumeBytes).toBeLessThan(Buffer.byteLength(JSON.stringify(cached)) / 10);
      resumed.messages.length = 0;
      await hub.webSocketMessage(
        resumed as never,
        JSON.stringify({
          type: 'command',
          data: {
            requestId: randomUUID(),
            command: { type: 'home-ticket-price', priceCents: 30000 },
          },
        }),
      );
      await drain();
      const incremental = snapshotDeltaSchema.parse(
        resumed.messages.find((m) => m.type === 'snapshot-delta')!.data,
      );
      expect(applyStateChanges(recovered, incremental.changes).homeTicketPrices).toEqual(
        (await service.snapshot(created.value.id, 'coach-0')).state.homeTicketPrices,
      );
      const afterIncremental = applyStateChanges(recovered, incremental.changes);
      const warmManifest = await snapshotManifest(
        { ...cached, state: afterIncremental },
        async (text) => {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
          return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join(
            '',
          );
        },
      );
      // Simulate the loss of in-memory socket state when a Durable Object hibernates.
      (hub as unknown as { sent: WeakMap<object, GameSnapshot> }).sent.delete(resumed);
      resumed.messages.length = 0;
      await service.command(
        created.value.id,
        'coach-0',
        { type: 'home-ticket-price', priceCents: 40000 },
        false,
        randomUUID(),
      );
      await drain();
      expect(resumed.messages.filter((m) => m.type === 'cache-request')).toHaveLength(1);
      await hub.webSocketMessage(
        resumed as never,
        JSON.stringify({ type: 'cache-offer', data: warmManifest }),
      );
      await drain();
      expect(resumed.messages.filter((m) => m.type === 'snapshot')).toHaveLength(0);
      const wakeDelta = snapshotDeltaSchema.parse(
        resumed.messages.find((m) => m.type === 'snapshot-delta')!.data,
      );
      expect(applyStateChanges(afterIncremental, wakeDelta.changes).homeTicketPrices).toEqual(
        (await service.snapshot(created.value.id, 'coach-0')).state.homeTicketPrices,
      );
      // Missing local data can always request a full state, without changing the world.
      resumed.messages.length = 0;
      await hub.webSocketMessage(resumed as never, JSON.stringify({ type: 'sync' }));
      await drain();
      expect(resumed.messages.filter((m) => m.type === 'snapshot')).toHaveLength(1);
      const meter = (hub as unknown as { meter: { totals: Record<string, number> } }).meter;
      writeFileSync(
        new URL('../../../docs/socket-resource-benchmark.json', import.meta.url),
        JSON.stringify(
          {
            scope:
              'Local mocked socket test, generated dataset, ten clients; NOT Cloudflare billing. Includes authentication, broadcast, repeated request and full sync recovery.',
            ...meter.totals,
            cacheResume: {
              fullSnapshotBytes: Buffer.byteLength(JSON.stringify(cached)),
              resumeBytes,
            },
            usageLogEvents: usageLogs.length,
            queueWaitMs: usageLogs.reduce((n, x) => n + (x.queueWaitMs ?? 0), 0),
            maxQueueWaitMs: Math.max(...usageLogs.map((x) => x.queueWaitMs ?? 0)),
            payloadBytes: sockets.reduce(
              (n, s) =>
                n + s.messages.reduce((m, x) => m + Buffer.byteLength(JSON.stringify(x)), 0),
              0,
            ),
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      log.mockRestore();
      db.close();
      vi.unstubAllGlobals();
    }
  }, 30000);
});
