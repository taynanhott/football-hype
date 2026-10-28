import { expect, test } from '@playwright/test';

test('menu mobile retrátil, categorias e filtros do mercado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  const shortcuts = page.getByRole('navigation', { name: 'Atalhos de navegação' });
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.locator('a, button')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden();
  await shortcuts.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mercado da bola' })).toBeVisible();
  await expect(shortcuts.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Série A', exact: true }).click();
  await expect(page.locator('.market-player').first()).toBeVisible();
  await page.getByRole('button', { name: '☆ Favoritar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(page.locator('.market-player')).toHaveCount(1);
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Filtrar jogadores' })).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(6);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await page
      .getByRole('dialog', { name: 'Filtrar jogadores' })
      .evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
        scroll: element.scrollHeight,
        client: element.clientHeight,
        viewport: innerHeight,
      }));
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
    await expect(page.getByRole('button', { name: /Ver resultados/ })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Ver resultados/ }).click();
  await page.locator('.player-card').first().click();
  await expect(page.locator('.card-back').first()).toContainText('★');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
