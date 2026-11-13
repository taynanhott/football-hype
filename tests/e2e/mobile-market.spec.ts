import { expect, test } from '@playwright/test';

test('menu mobile retrátil, categorias e filtros do mercado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  const shortcuts = page.getByRole('navigation', { name: 'Atalhos de navegação' });
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.locator('a, button')).toHaveCount(4);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden();
  await shortcuts.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Transferências', exact: true })
    .click();
  await expect(page.getByRole('group', { name: 'Categorias de jogadores' })).toBeVisible();
  await expect(shortcuts.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Série A', exact: true }).click();
  await expect(page.locator('.market-league-offers > .incoming-offer').first()).toBeVisible();
  await page.getByRole('button', { name: '☆ Favoritar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Filtros avançados', exact: true }).click();
  await page.getByRole('button', { name: /Favoritos/ }).click();
  await expect(page.locator('.market-league-offers > .incoming-offer')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Filtros avançados' })).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(8);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await page
      .getByRole('region', { name: 'Filtros avançados' })
      .evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
        scroll: element.scrollHeight,
        client: element.clientHeight,
        viewport: innerHeight,
      }));
    expect(bounds.client).toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
        message: 'Sem rolagem horizontal em ' + viewport.width + ' px',
      })
      .toBe(true);
    await expect(page.getByRole('button', { name: /Ver .*resultados/ })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Ver .*resultados/ }).click();
  await page.locator('.market-player-card-trigger').first().click();
  await page.getByRole('dialog').locator('.player-card').click();
  await expect(page.getByRole('dialog').locator('.card-back')).toContainText('★');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
