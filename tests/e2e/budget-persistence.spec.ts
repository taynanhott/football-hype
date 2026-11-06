import { expect, test } from '@playwright/test';

test('preserva a divisão de salários ao sair da aba durante uma edição', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){ return null; }',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  const budget = page.getByRole('slider', {
    name: 'Dividir orçamento entre salários e compras',
    exact: true,
  });
  await expect(budget).toBeEnabled();
  const max = Number(await budget.getAttribute('max'));
  const value = String(Math.floor((max * 0.6) / 10000) * 10000);
  await budget.fill(value);
  // Leave before pointerup/blur: the last edit must still enter the ordered queue.
  await page.evaluate(() => {
    location.hash = '/dashboard';
  });
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await expect(budget).toHaveValue(value);
  await budget.fill('0');
  await page.locator('body').dispatchEvent('pointerup');
  await expect(budget).toHaveValue('0');
  await budget.fill(value);
  await page.locator('body').dispatchEvent('pointerup');
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await expect(budget).toHaveValue(value);
});
