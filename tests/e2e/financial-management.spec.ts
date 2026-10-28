import { test, expect } from '@playwright/test';

test('salva limites financeiros e aplica a verba salarial no mercado', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Distribuição do caixa', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.financial-pie svg')).toBeVisible();
  await expect(page.locator('.financial-bars')).toBeVisible();
  await expect(page.getByText('Lucro médio por mês', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Transferências', exact: true }).fill('0');
  await page
    .getByRole('slider', { name: 'Transferências', exact: true })
    .dispatchEvent('pointerup');
  await expect(page.getByText('Salvo automaticamente', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Teto da folha mensal', exact: true }).fill('0');
  await page
    .getByRole('slider', { name: 'Teto da folha mensal', exact: true })
    .dispatchEvent('pointerup');
  await expect(page.getByText('Salvo automaticamente', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar limites financeiros' })).toHaveCount(0);
  await expect(page.locator('.finance-ledger table')).toHaveCount(0);
  await page.locator('.finance-ledger summary').click();
  await expect(page.locator('.finance-ledger table')).toBeVisible();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.locator('.market-player .negotiate-button:enabled').first().click();
  await expect(
    page.getByRole('slider', { name: 'Salário mensal em reais', exact: true }),
  ).toHaveAttribute('max', '0');
  await expect(page.getByRole('button', { name: 'Apresentar salário e assinar' })).toBeDisabled();
  await page.getByRole('button', { name: 'Fechar negociação' }).click();
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Teto da folha mensal', exact: true })).toHaveValue(
    '0',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
