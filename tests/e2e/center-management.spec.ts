import { expect, test } from '@playwright/test';
test('setores possuem identidade e gerenciamento por nível', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await expect(page.locator('.sector-card')).toHaveCount(5);
  await expect(page.locator('.sector-card .sector-avatar')).toHaveCount(5);
  await expect(
    page.locator('.sector-scouting').getByRole('button', { name: 'Gerenciar' }),
  ).toHaveCount(0);
  await page.locator('.sector-coaching').getByRole('button', { name: 'Gerenciar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Leve', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Leve', exact: false })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('dialog').screenshot({ path: 'test-results/ct-management.png' });
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.locator('.facility-grid').screenshot({ path: 'test-results/ct-sectors.png' });
  await page.locator('.sector-marketing').getByRole('button', { name: 'Gerenciar' }).click();
  await expect(page.locator('.marketing-benefits li')).toHaveCount(5);
});
