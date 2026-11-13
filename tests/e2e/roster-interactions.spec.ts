import { test, expect } from '@playwright/test';

test('elenco abre carta e gestão no modal; escalação aceita clique e arraste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await expect(page.locator('.squad-planning-list-row').first()).toBeVisible();
  await expect(page.locator('.player-management')).toHaveCount(0);
  await page.locator('.squad-planning-list-row').first().click();
  const detail = page.getByRole('dialog');
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Transferências', exact: true }).click();
  await expect(detail.getByRole('button', { name: 'No mercado', exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Contrato', exact: true }).click();
  await expect(detail.getByRole('button', { name: 'Rescindir contrato' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  const slots = page.locator('.tactics-player');
  await slots.first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.bench-player:not([disabled])').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const firstName = await slots.nth(0).locator('strong').textContent();
  const secondName = await slots.nth(1).locator('strong').textContent();
  const first = await slots.nth(0).boundingBox(),
    second = await slots.nth(1).boundingBox();
  if (!first || !second) throw new Error('Cartas não visíveis');
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(slots.nth(0).locator('strong')).toHaveText(secondName!);
  await expect(slots.nth(1).locator('strong')).toHaveText(firstName!);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.content-footer')).toHaveCount(0);
});
