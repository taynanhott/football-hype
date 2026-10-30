import { describe, it, vi, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createWorld } from '@football/domain';
import { randomUUID } from 'node:crypto';
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
    const { GameHub } = await import(modulePath);
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
    const hub = new GameHub(context as never, { USAGE_METRICS: 'false' } as never);
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
          data: { requestId: id, command: { type: 'home-ticket-price', priceCents: 7500 } },
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
          data: { requestId: id, command: { type: 'home-ticket-price', priceCents: 7500 } },
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
    } finally {
      db.close();
      vi.unstubAllGlobals();
    }
  }, 30000);
});
