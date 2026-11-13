import { test, expect } from '@playwright/test';

test('retratos variados e consulta das estruturas de outro clube preservam o clube do treinador', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await expect(page.locator('.squad-planning-list-row').first()).toBeVisible();
  const tones = await page
    .locator('.squad-list-portrait svg')
    .evaluateAll((nodes) => [
      ...new Set(
        nodes.flatMap((n) => [...n.querySelectorAll('[fill]')].map((p) => p.getAttribute('fill'))),
      ),
    ]);
  expect(tones.length).toBeGreaterThan(4);
  const clubs = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const state = store.snapshot.state;
    const own = state.participants.find(
      (p: { userId: string }) => p.userId === store.userId,
    ).clubId;
    const other = (Object.values(state.clubs.byId) as { id: string; name: string }[]).find(
      (c) => c.id !== own,
    ) as {
      id: string;
      name: string;
    };
    location.hash = '/trophies?club=' + other.id;
    return { own, other };
  });
  await expect(page.locator('.club-profile-identity strong')).toHaveText(clubs.other.name);
  await page.getByRole('button', { name: 'Cartas', exact: true }).click();
  await page.getByRole('button', { name: /Goleiros —/ }).click();
  await expect(page.locator('.club-inspection .player-card').first()).toBeVisible();
  const tabs = page.getByRole('group', { name: 'Dados do clube' });
  await tabs.getByRole('button', { name: 'Estádio', exact: true }).click();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Upgrade/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/other-club-stadium.png' });
  await tabs.getByRole('button', { name: 'CT', exact: true }).click();
  await expect(page.getByText('Preparação física', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Upgrade/ })).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const path = '/src/store/game-store.ts';
      const { useGameStore } = await import(path);
      const s = useGameStore.getState();
      return s.snapshot.state.participants.find((p: { userId: string }) => p.userId === s.userId)
        .clubId;
    }),
  ).toBe(clubs.own);
});
