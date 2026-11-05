import { describe, expect, it } from 'vitest';
import { applyStateChanges, stateChanges, snapshotManifest } from '../src/snapshot-sync.js';
import type { GameSnapshot, WorldState } from '../src/schemas/game.js';
import { createHash } from 'node:crypto';

describe('incremental snapshot protocol', () => {
  const fixture = () =>
    ({
      id: 'league',
      revision: 1,
      players: {
        ids: ['a', 'b'],
        byId: { a: { name: 'A', salary: 100 }, b: { name: 'B', salary: 200 } },
      },
      results: [{ id: 'match-1', score: 1 }],
      management: { policies: { a: { available: true } } },
    }) as unknown as WorldState;
  it('sends changed fields and appended matches without replacing collections', () => {
    const before = fixture();
    const next = structuredClone(before) as unknown as Record<string, unknown>;
    (next.players as { byId: Record<string, { salary: number }> }).byId.a!.salary = 150;
    (next.results as unknown[]).push({ id: 'match-2', score: 0 });
    next.revision = 2;
    const changes = stateChanges(before, next as unknown as WorldState);
    expect(changes).toContainEqual({ path: ['players', 'byId', 'a', 'salary'], value: 150 });
    expect(changes).toContainEqual({
      path: ['results'],
      value: [{ id: 'match-2', score: 0 }],
      appendFrom: 1,
    });
    const applied = applyStateChanges(before, changes);
    expect(applied).toEqual(next);
    expect(applied.players.byId.b).toBe(before.players.byId.b);
    expect((before.players.byId.a as unknown as { salary: number }).salary).toBe(100);
  });
  it('supports removals, optional branches and rejects malformed paths/appends', () => {
    const before = fixture();
    const next = structuredClone(before);
    delete (next.management!.policies as Record<string, unknown>).a;
    expect(applyStateChanges(before, stateChanges(before, next))).toEqual(next);
    expect(() =>
      applyStateChanges(before, [{ path: ['players', '__proto__', 'polluted'], value: true }]),
    ).toThrow();
    expect(() => applyStateChanges(before, [{ path: ['notAWorldBranch'], value: 1 }])).toThrow();
    expect(() =>
      applyStateChanges(before, [{ path: ['results'], value: [], appendFrom: 99 }]),
    ).toThrow();
    expect(
      applyStateChanges(before, [{ path: ['homeTicketPrices'], value: { club: 5000 } }])
        .homeTicketPrices,
    ).toEqual({ club: 5000 });
  });
  it('compacts dense development changes without losing removals or mutating the base', () => {
    const before = { ...fixture(), development: { a: 1, b: 2, c: 3 } };
    const next = { ...before, development: { a: 2, b: 3, d: 4 }, revision: 2 };
    const changes = stateChanges(before, next);
    expect(changes).toContainEqual({ path: ['development'], value: next.development });
    expect(applyStateChanges(before, changes)).toEqual(next);
    expect(before.development).toEqual({ a: 1, b: 2, c: 3 });
  });
  it('fingerprints cached contents, including changes without revision changes', async () => {
    const state = fixture();
    const snapshot = { state } as GameSnapshot;
    const hash = async (text: string) => createHash('sha256').update(text).digest('hex');
    const before = await snapshotManifest(snapshot, hash);
    const next = structuredClone(snapshot);
    (next.state.players.byId.a as unknown as { salary: number }).salary = 300;
    const after = await snapshotManifest(next, hash);
    expect(after.hashes.players).not.toBe(before.hashes.players);
    expect(after.hashes.results).toBe(before.hashes.results);
  });
  it('reuses unchanged branch hashes and matches a full manifest after deletions', async () => {
    const snapshot = { state: fixture() } as GameSnapshot;
    let calls = 0;
    const hash = async (text: string) => {
      calls++;
      return createHash('sha256').update(text).digest('hex');
    };
    const manifest = await snapshotManifest(snapshot, hash);
    const fullCalls = calls;
    const next = { ...snapshot, state: { ...snapshot.state, revision: 2 } };
    delete next.state.management;
    calls = 0;
    const incremental = await snapshotManifest(next, hash, { snapshot, manifest });
    expect(calls).toBeLessThan(fullCalls);
    expect(incremental).toEqual(await snapshotManifest(next, hash));
    expect(snapshot.state.management).toBeDefined();
  });
});
