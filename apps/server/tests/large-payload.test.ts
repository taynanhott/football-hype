import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { createWorld } from '@football/domain';
import { FirestoreLeagueRepository } from '../src/repositories/firestore-league-repository.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
type Data = Record<string, unknown>;
class Ref {
  constructor(
    readonly db: MemoryDb,
    readonly path: string,
  ) {}
  collection(name: string) {
    return new Collection(this.db, `${this.path}/${name}`);
  }
  async get() {
    return new Snapshot(this, this.db.docs.get(this.path));
  }
}
class Snapshot {
  constructor(
    readonly ref: Ref,
    private readonly value: Data | undefined,
  ) {}
  get exists() {
    return this.value !== undefined;
  }
  get(key: string) {
    return this.value?.[key];
  }
  data() {
    return this.value ?? {};
  }
}
class Collection {
  constructor(
    private readonly db: MemoryDb,
    private readonly path: string,
  ) {}
  doc(id: string) {
    return this.db.doc(`${this.path}/${id}`);
  }
  select() {
    return this;
  }
  orderBy() {
    return this;
  }
  limit() {
    return this;
  }
  async get() {
    return {
      docs: [...this.db.docs]
        .filter(
          ([path]) =>
            path.startsWith(`${this.path}/`) && !path.slice(this.path.length + 1).includes('/'),
        )
        .map(([path, data]) => new Snapshot(this.db.doc(path), data))
        .sort((a, b) => Number(b.get('sequence')) - Number(a.get('sequence'))),
    };
  }
}
class MemoryDb {
  readonly docs = new Map<string, Data>();
  readonly batchSizes: number[] = [];
  doc(path: string) {
    return new Ref(this, path);
  }
  readonly masks: string[][] = [];
  async getAll(...args: (Ref | { fieldMask: string[] })[]) {
    const options = args.find((arg) => !(arg instanceof Ref)) as
      { fieldMask: string[] } | undefined;
    if (options) this.masks.push(options.fieldMask);
    return Promise.all(
      args
        .filter((arg): arg is Ref => arg instanceof Ref)
        .map(async (ref) => {
          const data = this.docs.get(ref.path);
          return new Snapshot(
            ref,
            data && options
              ? Object.fromEntries(options.fieldMask.map((key) => [key, data[key]]))
              : data,
          );
        }),
    );
  }
  batch() {
    const writes: [Ref, Data][] = [];
    return {
      set: (ref: Ref, data: Data) => {
        writes.push([ref, data]);
      },
      commit: async () => {
        this.batchSizes.push(
          writes.reduce(
            (sum, [, data]) => sum + (Buffer.isBuffer(data.payload) ? data.payload.length : 0),
            0,
          ),
        );
        for (const [ref, data] of writes) this.docs.set(ref.path, data);
      },
    };
  }
  async runTransaction<T>(
    fn: (transaction: {
      get: (ref: Ref) => Promise<Snapshot>;
      getAll: (...args: (Ref | { fieldMask: string[] })[]) => Promise<Snapshot[]>;
      update: (ref: Ref, data: Data) => void;
      set: (ref: Ref, data: Data, options?: { merge?: boolean }) => void;
      create: (ref: Ref, data: Data) => void;
    }) => Promise<T>,
  ) {
    const writes: [Ref, Data][] = [];
    const result = await fn({
      get: (ref) => ref.get(),
      getAll: (...args) => this.getAll(...args),
      update: (ref, data) => {
        writes.push([ref, { ...this.docs.get(ref.path), ...data }]);
      },
      set: (ref, data, options) => {
        writes.push([ref, options?.merge ? { ...this.docs.get(ref.path), ...data } : data]);
      },
      create: (ref, data) => {
        if (this.docs.has(ref.path)) throw new Error('Já existe');
        writes.push([ref, data]);
      },
    });
    for (const [ref, data] of writes) this.docs.set(ref.path, data);
    return result;
  }
}
describe('payloads grandes das trajetórias', () => {
  it('grava partes em lotes e uma tentativa obsoleta não altera o snapshot publicado', async () => {
    const db = new MemoryDb();
    const repository = new FirestoreLeagueRepository(db as unknown as Firestore);
    const state = unwrap(
      createWorld({
        id: randomUUID(),
        userId: 'large-state',
        name: 'Trajetórias',
        mode: 'offline',
        now: Date.parse('2026-10-26T15:00:00Z'),
      }),
    );
    state.ratingHistory = Array.from({ length: 40000 }, () => ({
      fixtureId: randomUUID(),
      playerId: state.players.ids[0]!,
      season: 2026,
      rating: 6.5,
    }));
    await repository.create(state);
    expect((await repository.load(state.id, { eventPatches: false }))?.state).toBe(state);
    expect(db.masks).toEqual([['revision', 'status']]);
    const before = db.docs.get(`leagues/${state.id}`)!;
    expect((before.partIds as string[]).length).toBeGreaterThan(1);
    expect(db.batchSizes.every((size) => size <= 4_800_000)).toBe(true);
    expect((await repository.load(state.id))?.state).toEqual(state);
    const next = {
      ...state,
      revision: 1,
      ratingHistory: [
        ...state.ratingHistory,
        { fixtureId: randomUUID(), playerId: state.players.ids[0]!, season: 2026, rating: 9 },
      ],
    };
    const event = {
      id: randomUUID(),
      sequence: 1,
      occurredAt: state.createdAt,
      actorId: 'large-state',
      type: 'league.updated' as const,
      message: 'Atualização',
      amount: 0,
      patch: { ratingHistory: next.ratingHistory, revision: 1 },
    };
    await expect(repository.append(state.id, 99, next, event)).rejects.toThrow('mudou');
    expect(db.docs.get(`leagues/${state.id}`)).toBe(before);
    expect((await repository.load(state.id))?.state).toEqual(state);
    await repository.append(state.id, 0, next, event);
    expect((await repository.load(state.id))?.state).toEqual(next);
    expect((await repository.load(state.id))?.events).toEqual([event]);
    await expect(repository.remove(state.id, 'intruso', Date.now())).rejects.toThrow(
      'Acesso negado',
    );
    const payload = db.docs.get(`leagues/${state.id}`)!.payload;
    const batches = db.batchSizes.length;
    await repository.remove(state.id, 'large-state', Date.now());
    expect(db.docs.get(`leagues/${state.id}`)!.payload).toBe(payload);
    expect(db.batchSizes).toHaveLength(batches);
    expect(db.docs.get('memberships/large-state')?.offline).toBeNull();
    expect(await repository.load(state.id)).toBeUndefined();
    expect(await repository.load(state.id, { eventPatches: false })).toBeUndefined();
    await expect(
      repository.append(
        state.id,
        2,
        { ...next, revision: 3 },
        { ...event, id: randomUUID(), sequence: 3 },
      ),
    ).rejects.toThrow('mudou');
    expect(db.docs.get(`leagues/${state.id}`)!.status).toBe('deleted');
  });
});
