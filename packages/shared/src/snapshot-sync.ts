import { z } from 'zod';
import type { GameSnapshot, WorldState } from './schemas/game.js';
import { worldStateSchema } from './schemas/game.js';

import { type SnapshotCacheManifest } from './schemas/snapshot-cache.js';
export { snapshotCacheSchema, type SnapshotCacheManifest } from './schemas/snapshot-cache.js';
export const snapshotDeltaSchema = z.object({
  leagueId: z.uuid(),
  baseRevision: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  changes: z
    .array(
      z.object({
        path: z.array(z.string().max(128)).min(1).max(8),
        value: z.unknown().optional(),
        remove: z.boolean().optional(),
        appendFrom: z.number().int().nonnegative().optional(),
      }),
    )
    .max(200000),
  ledger: z.unknown(),
  tables: z.unknown(),
  roomId: z.string(),
  serverTime: z.number().optional(),
});
export type StateChange = z.infer<typeof snapshotDeltaSchema>['changes'][number];
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function* jsonTokens(value: unknown): Generator<string> {
  if (Array.isArray(value)) {
    yield '[';
    for (let i = 0; i < value.length; i++) {
      if (i) yield ',';
      yield* jsonTokens(value[i] ?? null);
    }
    yield ']';
  } else if (value && typeof value === 'object') {
    yield '{';
    let first = true;
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      if (!first) yield ',';
      first = false;
      yield JSON.stringify(key);
      yield ':';
      yield* jsonTokens(child);
    }
    yield '}';
  } else yield JSON.stringify(value) ?? 'null';
}
export async function snapshotManifest(
  snapshot: GameSnapshot,
  hash: (value: string) => Promise<string>,
): Promise<SnapshotCacheManifest> {
  const hashes: Record<string, string> = {};
  // Sequential hashing bounds temporary memory for large branches.
  for (const [key, value] of Object.entries(snapshot.state)) {
    if (value === undefined) continue;
    const chunks: string[] = [];
    let buffer = '';
    for (const token of jsonTokens(value)) {
      for (let offset = 0; offset < token.length;) {
        const count = Math.min(32768 - buffer.length, token.length - offset);
        buffer += token.slice(offset, offset + count);
        offset += count;
        if (buffer.length === 32768) {
          chunks.push(await hash(JSON.stringify(buffer)));
          buffer = '';
        }
      }
    }
    if (buffer) chunks.push(await hash(JSON.stringify(buffer)));
    hashes[key] = await hash(chunks.join(''));
  }
  return { version: 1, revision: snapshot.state.revision, hashes };
}
export function stateChanges(previous: WorldState, next: WorldState): StateChange[] {
  const changes: StateChange[] = [];
  function visit(a: unknown, b: unknown, path: string[]) {
    if (a === b) return;
    if (
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b) &&
      path.length < 7
    ) {
      const old = a as Record<string, unknown>,
        current = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(old), ...Object.keys(current)])) {
        if (forbidden.has(key)) throw new Error('Invalid state key');
        if (!(key in current)) changes.push({ path: [...path, key], remove: true });
        else visit(old[key], current[key], [...path, key]);
      }
    } else if (Array.isArray(a) && Array.isArray(b)) {
      const prefix =
        b.length >= a.length &&
        a.every(
          (item, index) => item === b[index] || JSON.stringify(item) === JSON.stringify(b[index]),
        );
      if (prefix && b.length > a.length)
        changes.push({ path, value: b.slice(a.length), appendFrom: a.length });
      else if (!prefix) changes.push({ path, value: b });
    } else if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path, value: b });
  }
  visit(previous, next, []);
  return changes;
}
export function applyStateChanges(state: WorldState, changes: StateChange[]): WorldState {
  // Copy each touched object once; never mutate confirmed/cache state.
  const root = { ...state } as unknown as Record<string, unknown>;
  const copied = new WeakSet<object>([root]);
  for (const change of changes) {
    if (
      !change.path.length ||
      change.path.length > 8 ||
      change.path.some((key) => forbidden.has(key)) ||
      !Object.hasOwn(worldStateSchema.shape, change.path[0]!)
    )
      throw new Error('Invalid snapshot path');
    let node = root;
    for (const key of change.path.slice(0, -1)) {
      const child = node[key];
      if (!child || typeof child !== 'object' || Array.isArray(child))
        throw new Error('Invalid snapshot parent');
      if (!copied.has(child)) {
        node[key] = { ...child };
        copied.add(node[key] as object);
      }
      node = node[key] as Record<string, unknown>;
    }
    const key = change.path.at(-1)!;
    if (change.appendFrom !== undefined) {
      const previous = node[key];
      if (
        !Array.isArray(previous) ||
        previous.length !== change.appendFrom ||
        !Array.isArray(change.value)
      )
        throw new Error('Invalid append');
      node[key] = [...previous, ...change.value];
    } else if (change.remove) delete node[key];
    else node[key] = change.value;
  }
  return root as unknown as WorldState;
}
