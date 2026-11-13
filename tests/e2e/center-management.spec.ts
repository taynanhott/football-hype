import { expect, test } from '@playwright/test';
test('setores possuem identidade e gerenciamento por nível', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await expect(page.locator('.sector-card')).toHaveCount(5);
  await expect(page.locator('.sector-card .sector-avatar')).toHaveCount(5);
  await page.getByRole('tab', { name: 'Preparação Técnica', exact: true }).click();
  await page.locator('section.sector-coaching').getByRole('button', { name: 'Gerenciar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Leve', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Leve', exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('dialog').screenshot({ path: 'test-results/ct-management.png' });
  await page.getByRole('button', { name: 'Salvar treino', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.locator('.facility-grid').screenshot({ path: 'test-results/ct-sectors.png' });
  await page.getByRole('tab', { name: 'Marketing', exact: true }).click();
  await page.locator('section.sector-marketing').getByRole('button', { name: 'Gerenciar' }).click();
  await expect(page.locator('.marketing-benefits li')).toHaveCount(5);
});
