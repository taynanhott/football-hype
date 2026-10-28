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
  async getAll(...refs: Ref[]) {
    return Promise.all(refs.map((ref) => ref.get()));
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
      set: (ref: Ref, data: Data, options?: { merge?: boolean }) => void;
      create: (ref: Ref, data: Data) => void;
    }) => Promise<T>,
  ) {
    const writes: [Ref, Data][] = [];
    const result = await fn({
      get: (ref) => ref.get(),
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
  });
});
