import { expect, test } from '@playwright/test';
test('formulário ocupa a linha e planejamentos excluem protegidos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 844 });
  await page.getByRole('button', { name: /ESCALAÇÕES SALVAS/ }).click();
  await page.getByRole('button', { name: '+ Salvar atual', exact: true }).click();
  const form = page.locator('.preset-name-form');
  await expect(form).toBeVisible();
  expect(await form.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: /Não substituir ·/ }).click();
  const player = page.getByRole('dialog').locator('.bench-player:not(:disabled)').first();
  const name = await player.locator('strong').textContent();
  await player.click();
  await page.getByRole('button', { name: '+ Planejar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Jogador que sai · troca 1', exact: true }).click();
  await expect(
    page
      .getByRole('listbox')
      .filter({ visible: true })
      .getByRole('option')
      .filter({ hasText: name! }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(
    await page.locator('.planned-inline-row').evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
});
