import {
  snapshotCacheSchema,
  type GameSnapshot,
  type SnapshotCacheManifest,
} from '@football/shared';
let worker: Worker | undefined,
  id = 0;
const pending = new Map<number, (value: unknown) => void>();
function request(
  type: 'load' | 'save' | 'manifest',
  key: string,
  snapshot?: GameSnapshot,
): Promise<unknown> {
  try {
    worker ??= new Worker(new URL('./snapshot-cache.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      pending.get(event.data.id)?.(event.data.value);
      pending.delete(event.data.id);
    };
    worker.onerror = () => {
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
    return new Promise((resolve) => {
      const requestId = ++id;
      pending.set(requestId, resolve);
      worker!.postMessage({ id: requestId, type, key, snapshot });
      setTimeout(
        () => {
          if (pending.delete(requestId)) resolve(null);
        },
        type === 'load' ? 2000 : 30000,
      );
    });
  } catch {
    return Promise.resolve(null);
  }
}
export async function loadSnapshotCache(
  key: string,
): Promise<{ snapshot: GameSnapshot; manifest: SnapshotCacheManifest } | null> {
  const value = (await request('load', key)) as {
    snapshot: GameSnapshot;
    manifest: unknown;
  } | null;
  const parsed = snapshotCacheSchema.safeParse(value?.manifest);
  return value && parsed.success && value.snapshot.state.revision === parsed.data.revision
    ? { snapshot: value.snapshot, manifest: parsed.data }
    : null;
}
export async function prepareSnapshotManifest(
  snapshot: GameSnapshot,
): Promise<SnapshotCacheManifest | null> {
  const result = snapshotCacheSchema.safeParse(await request('manifest', '', snapshot));
  return result.success ? result.data : null;
}
let timer: ReturnType<typeof setTimeout> | undefined;
export function saveSnapshotCache(key: string, snapshot: GameSnapshot) {
  clearTimeout(timer);
  // Bound hashing/persistence frequency; never checkpoint optimistic projections.
  timer = setTimeout(() => {
    void request('save', key, { ...snapshot, tables: {} });
  }, 1500);
}
