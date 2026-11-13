import { expect, test } from '@playwright/test';

test('abre a aplicação em português', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Football Hype');
  await expect(page.getByRole('button', { name: /Nova carreira solo/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});
