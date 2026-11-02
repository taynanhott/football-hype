import { expect, test } from '@playwright/test';

test('escalações empilhadas recolhem no mobile e apoio alinha abaixo dos reservas no desktop', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '+ Salvar atual', exact: true }).click();
    await page.locator('#preset-name').fill(`Time ${i + 1}`);
    await page.getByRole('button', { name: 'Salvar preset atual', exact: true }).click();
    await expect(page.locator('.lineup-preset')).toHaveCount(i + 1);
  }
  const support = page.locator('.lineup-support');
  await expect(support.locator('.unavailable-players')).toHaveCount(1);
  await expect(support.locator('.sector-chemistry')).toHaveCount(1);
  const bench = (await page.locator('.reserve-roster').boundingBox())!;
  const bounds = (await support.boundingBox())!;
  const sidebar = (await page.locator('.tactics-sidebar').boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(bench.y + bench.height);
  const unavailable = (await support.locator('.unavailable-players').boundingBox())!;
  const chemistry = (await support.locator('.sector-chemistry').boundingBox())!;
  expect(unavailable.y + unavailable.height).toBeLessThanOrEqual(chemistry.y);
  expect(unavailable.width).toBeCloseTo(chemistry.width, 0);
  await expect(support.getByText('Todo o elenco está disponível.', { exact: true })).toBeVisible();
  for (const section of ['related', 'unrelated'])
    await page.locator(`.reserve-section.${section} summary`).click();
  expect((await page.locator('.tactics-sidebar').boundingBox())!.height).toBeCloseTo(
    sidebar.height,
    0,
  );
  const expandedBench = (await page.locator('.reserve-roster').boundingBox())!;
  expect((await support.boundingBox())!.y).toBeGreaterThanOrEqual(
    expandedBench.y + expandedBench.height,
  );
  await support.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-temp/lineup-support-desktop.png' });
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const cards = await page.locator('.lineup-preset').evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    expect(cards).toHaveLength(3);
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i]!.y).toBeGreaterThanOrEqual(cards[i - 1]!.y + cards[i - 1]!.height);
      expect(cards[i]!.width).toBeCloseTo(cards[0]!.width, 0);
    }
    await page.screenshot({ path: `.test-temp/saved-lineups-stacked-${width}.png` });
    const toggle = page.getByRole('button', { name: /ESCALAÇÕES SALVAS/ });
    await toggle.click();
    await expect(page.locator('.lineup-presets-body')).toBeHidden();
    await toggle.click();
    await expect(page.locator('.lineup-presets-body')).toBeVisible();
    const plan = (await page
      .getByRole('button', { name: '+ Planejar', exact: true })
      .boundingBox())!;
    expect(plan.height).toBeGreaterThanOrEqual(44);
    expect(plan.width).toBeGreaterThanOrEqual(108);
    await page.getByRole('button', { name: /Não substituir ·/ }).click();
    const modal = page.getByRole('dialog', { name: 'Não substituir', exact: true });
    await modal.locator('.bench-player:not(:disabled)').first().click();
    for (const button of await page.locator('.protected-players > button').all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    for (const label of await page.locator('.protected-button-label').all())
      expect(await label.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
  }
  await page.getByRole('button', { name: /ESCALAÇÕES SALVAS/ }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.lineup-presets-body')).toBeVisible();
  await expect(page.locator('.lineup-presets-toggle')).toBeHidden();
});
