import { expect, test } from '@playwright/test';

test('abre a aplicação em português', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Football Manager Brasil');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Escolha as suas cores.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});
