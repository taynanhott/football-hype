import { expect, test } from '@playwright/test';

test('dia inteiro abre detalhes, folha preenche modal e mercado não recarrega em ciclo', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  const day = page
    .locator('.club-calendar-day.match-day')
    .filter({ has: page.locator('.club-calendar-event') })
    .first();
  await day.click({ position: { x: 3, y: 3 } });
  const details = page.locator('.game-details-modal');
  await expect(details).toBeVisible();
  expect(await details.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  const over = details.locator('.game-details-team-overall').first();
  expect(await over.locator('strong').evaluate((e) => getComputedStyle(e).fontFamily)).toContain(
    'Press Start 2P',
  );
  expect(await over.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain(
    'linear-gradient',
  );
  await page.screenshot({ path: 'test-results/calendar-pixel-rating.png' });
  await details.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.evaluate(() => {
    location.hash = '/finance';
  });
  await page.locator('.ledger-leather-cover').click();
  const book = page.locator('.ledger-book-modal');
  await expect(book).toBeVisible();
  await expect.poll(() => book.locator('.agenda-table tbody tr').count()).toBeGreaterThan(1);
  expect(await book.locator('.agenda-blank-row').count()).toBe(
    await book.locator('.agenda-table tbody tr').count(),
  );
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width === 1280)
      await expect
        .poll(() => book.evaluate((e) => e.getBoundingClientRect().width))
        .toBeGreaterThan(1050);
    const fill = await book.evaluate((e) => {
      const body = e.querySelector('.modal-content')!.getBoundingClientRect();
      const sheet = e.querySelector('.agenda-sheet')!.getBoundingClientRect();
      return { gap: body.bottom - sheet.bottom, ratio: sheet.height / body.height };
    });
    expect(fill.gap).toBeLessThan(15);
    expect(fill.ratio).toBeGreaterThan(0.95);
    await page.screenshot({ path: `test-results/ledger-full-sheet-${viewport.width}.png` });
  }
  await book.getByRole('button', { name: 'Fechar', exact: true }).click();
  for (const route of ['training', 'stadium']) {
    await page.evaluate((route) => {
      location.hash = '/' + route;
    }, route);
    const tabs = page.locator('.facility-two-row-tabs');
    await expect(tabs.getByRole('tab')).toHaveCount(route === 'training' ? 5 : 6);
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await tabs.evaluate((e) => {
        const r = e.getBoundingClientRect();
        const buttons = Array.from(e.querySelectorAll('button')).map((b) =>
          b.getBoundingClientRect(),
        );
        return {
          fits: e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
          rows: new Set(buttons.map((b) => Math.round(b.top))).size,
          inside: buttons.every((b) => b.left >= r.left - 1 && b.right <= r.right + 1),
          full: Array.from(new Set(buttons.map((b) => b.top))).every(
            (y) => Math.abs(buttons.filter((b) => b.top === y).at(-1)!.right - r.right) < 1,
          ),
        };
      });
      expect(layout).toEqual({ fits: true, rows: 2, inside: true, full: true });
    }
    await page.screenshot({ path: `test-results/${route}-all-tabs-two-rows.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    location.hash = '/market';
  });
  await page.getByRole('button', { name: 'Cartas', exact: true }).click();
  const rows = page.locator('.market-league-offers > .incoming-offer');
  const count = await rows.count();
  await page.locator('.market-infinite-loading').scrollIntoViewIfNeeded();
  await expect.poll(() => rows.count()).toBeGreaterThan(count);
  const after = await rows.count();
  const position = await page.evaluate(() => scrollY);
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  expect(await rows.count()).toBe(after);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await page.locator('.market-infinite-loading').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 40);
  await expect.poll(() => rows.count()).toBeGreaterThan(after);
});
