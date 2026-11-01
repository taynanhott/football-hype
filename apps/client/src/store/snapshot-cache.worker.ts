import {
  gameSnapshotSchema,
  snapshotCacheSchema,
  snapshotManifest,
  type GameSnapshot,
} from '@football/shared';
const digestText = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
};
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('football-snapshots-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: 'load' | 'save' | 'manifest';
    key: string;
    snapshot?: GameSnapshot;
  }>,
) => {
  const { id, type, key, snapshot } = event.data;
  try {
    if (type === 'manifest' && snapshot) {
      self.postMessage({ id, value: await snapshotManifest(snapshot, digestText) });
      return;
    }
    const db = await dbPromise;
    if (type === 'save' && snapshot) {
      const manifest = await snapshotManifest(snapshot, async (text) => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite'),
          store = tx.objectStore('snapshots');
        // A single latest checkpoint bounds disk usage across careers/accounts.
        store.clear();
        store.put({ snapshot, manifest, savedAt: Date.now() }, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      self.postMessage({ id, value: true });
    } else {
      const value = (await new Promise<unknown>((resolve, reject) => {
        const r = db.transaction('snapshots').objectStore('snapshots').get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      })) as { snapshot: unknown; manifest: unknown; savedAt: number } | undefined;
      const parsed =
        value && Date.now() - value.savedAt < 7 * 86400000
          ? gameSnapshotSchema.safeParse(value.snapshot)
          : undefined;
      const stored = snapshotCacheSchema.safeParse(value?.manifest);
      const manifest = parsed?.success ? await snapshotManifest(parsed.data, digestText) : null;
      const valid =
        manifest &&
        stored.success &&
        manifest.revision === stored.data.revision &&
        JSON.stringify(manifest.hashes) === JSON.stringify(stored.data.hashes);
      self.postMessage({
        id,
        value: valid && parsed?.success ? { snapshot: parsed.data, manifest } : null,
      });
    }
  } catch {
    self.postMessage({ id, value: null });
  }
};
