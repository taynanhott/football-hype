import { test, expect } from '@playwright/test';
test('filtros têm prévia e só atualizam a listagem após confirmar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Exterior', exact: true }).click();
  const rows = page.locator('.market-league-offers > .incoming-offer');
  await expect(rows.first()).toBeVisible();
  const initial = await rows.count();
  await page.getByRole('button', { name: 'Filtros avançados', exact: true }).click();
  const filters = page.getByRole('region', { name: 'Filtros avançados' });
  const apply = filters.getByRole('button', { name: /Ver .*resultados/ });
  await filters.getByRole('slider', { name: 'Overall mínimo', exact: true }).fill('99');
  await expect(apply).toHaveText('Ver 0 resultados');
  await expect(rows).toHaveCount(initial);
  await apply.click();
  await expect(rows).toHaveCount(0);
  await page.getByRole('button', { name: /Filtros avançados/ }).click();
  await filters.getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(rows.first()).toBeVisible();
  await page.getByRole('button', { name: /Filtros avançados/ }).click();
  await expect(filters.getByRole('slider', { name: 'Overall mínimo', exact: true })).toHaveValue(
    '1',
  );
});
