import { expect, test } from '@playwright/test';

test('cache persiste confirmado no navegador, isola usuários e recusa conteúdo corrompido', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toHaveText('✓ Carreira sincronizada', {
    timeout: 20000,
  });
  await page.evaluate(async () => {
    const storePath = '/src/store/game-store.ts',
      cachePath = '/src/store/snapshot-cache.ts';
    const { useGameStore } = await import(storePath),
      { saveSnapshotCache } = await import(cachePath);
    saveSnapshotCache('cache-test-user', useGameStore.getState().snapshot);
  });
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const path = '/src/store/snapshot-cache.ts';
          const { loadSnapshotCache } = await import(path);
          return Boolean(await loadSnapshotCache('cache-test-user'));
        }),
      { timeout: 15000 },
    )
    .toBe(true);
  await page.reload();
  const result = await page.evaluate(async () => {
    const path = '/src/store/snapshot-cache.ts';
    const { loadSnapshotCache } = await import(path);
    const cached = await loadSnapshotCache('cache-test-user');
    const other = await loadSnapshotCache('another-user');
    return { found: Boolean(cached), version: cached?.manifest.version, other };
  });
  expect(result).toEqual({ found: true, version: 1, other: null });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('football-snapshots-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite'),
        store = tx.objectStore('snapshots'),
        r = store.get('cache-test-user');
      r.onsuccess = () => {
        const value = r.result;
        value.snapshot.state.name = 'Corrupted cache';
        store.put(value, 'cache-test-user');
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  expect(
    await page.evaluate(async () => {
      const path = '/src/store/snapshot-cache.ts';
      return (await import(path)).loadSnapshotCache('cache-test-user');
    }),
  ).toBeNull();
});
