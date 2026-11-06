import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){ return null; }',
    }),
  );
  await page.goto('/');
});

test('alinha carreiras, criação e convite no desktop', async ({ page }) => {
  const header = await page.locator('.lobby-header').boundingBox();
  const saves = await page.locator('.career-saves').boundingBox();
  expect(Math.abs(header!.x - saves!.x)).toBeLessThan(2);
  expect(Math.abs(header!.width - saves!.width)).toBeLessThan(2);
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  const toolbar = await page.locator('.career-toolbar').boundingBox();
  const creation = await page.locator('.creation-workspace').boundingBox();
  expect(Math.abs(header!.x - toolbar!.x)).toBeLessThan(2);
  expect(Math.abs(header!.x - creation!.x)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Suas carreiras' }).click();
  await page.getByRole('button', { name: /Entrar com convite/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Entrar em uma liga' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(544);
  expect(box!.height).toBeLessThan(550);
  const back = await dialog.getByRole('button', { name: 'Fechar', exact: true }).boundingBox();
  expect(back!.x - box!.x).toBeGreaterThan(18);
  expect(box!.y + box!.height - back!.y - back!.height).toBeGreaterThan(18);
  await dialog.screenshot({ path: 'test-results/invite-desktop-regression.png' });
});

test('preserva o debuff ao arrastar e diferencia reconexão de avanço', async ({ page }) => {
  test.setTimeout(60000);
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  const card = page
    .locator('.tactics-player')
    .filter({ has: page.locator('.overall-modifier') })
    .first();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 100, box!.y + box!.height / 2 + 50, { steps: 8 });
  const preview = page.locator('.dragged-card-preview');
  await expect(preview).toBeVisible();
  await expect(preview.locator('.overall-modifier')).toBeVisible();
  const style = await preview.evaluate((el) => {
    const s = getComputedStyle(el);
    return { contain: s.contain, overflow: s.overflow, clip: s.clipPath };
  });
  expect(style.contain).not.toContain('paint');
  expect(style.overflow).toBe('visible');
  expect(style.clip).toBe('none');
  await page.screenshot({ path: 'test-results/drag-debuff-regression.png' });
  await page.mouse.up();
  await page.evaluate(async () => {
    const modulePath = '/src/store/game-store.ts';
    const { useGameStore } = await import(modulePath);
    useGameStore.setState({ connected: false, busy: true, loadingActivity: 'travel' });
  });
  await expect(page.getByText('Restabelecendo conexão…', { exact: true })).toBeVisible();
  await expect(page.getByText('Time em movimento…', { exact: true })).toHaveCount(0);
});
