import { expect, test } from '@playwright/test';
test('salva disponibilidade imediatamente e mantém os controles acessíveis no mobile', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await page.locator('.squad-planning-list-row').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Transferências', exact: true }).click();
  await dialog.getByRole('button', { name: 'No mercado', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await page.locator('.squad-planning-list-row').first().click();
  await dialog.getByRole('button', { name: 'Transferências', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'No mercado', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
