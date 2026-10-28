import { selectOption } from './select-option';
import { expect, test } from '@playwright/test';

test('prévia dos cinco estádios e gramados preserva as melhorias reais', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await expect(page.getByRole('heading', { name: 'O próximo capítulo começa aqui.' })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nosso elenco', exact: true })).toBeVisible();
  await expect(page.locator('.pixel-portrait').first()).toHaveAttribute(
    'shape-rendering',
    'crispEdges',
  );
  await page.screenshot({ path: 'test-results/pixel-squad.png' });
  await page.getByRole('link', { name: 'Estádio', exact: true }).click();
  const structure = page
    .locator('.facility-card')
    .filter({ has: page.getByRole('heading', { name: 'Estrutura do Estádio', exact: true }) });
  for (let level = 1; level <= 5; level++) {
    await selectOption(page.getByLabel('Prévia da estrutura'), String(level));
    await selectOption(page.getByLabel('Prévia do gramado'), String(level));
    await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 20000 });
    await expect(structure.getByText('NÍVEL 3 / 5')).toBeVisible();
    await page.waitForTimeout(1200);
    await page
      .locator('.facility-scene')
      .screenshot({ path: `test-results/stadium-level-${level}.png` });
  }
  await page.getByRole('button', { name: 'Voltar ao estádio atual' }).click();
  await page.locator('.facility-scene canvas').hover();
  await page.mouse.wheel(0, 12000);
  await page.waitForTimeout(500);
  await page
    .locator('.facility-scene')
    .screenshot({ path: 'test-results/stadium-max-distance.png' });
  await expect(page.getByLabel('Prévia da estrutura')).toHaveValue('');
  await expect(page.getByLabel('Prévia do gramado')).toHaveValue('');
  expect(errors).toEqual([]);
});
