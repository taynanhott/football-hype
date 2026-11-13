import { expect, test } from '@playwright/test';
import { selectOption } from './select-option';
test('planeja trocas, persiste regras e mantém controles compactos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await page.getByRole('button', { name: '+ Planejar', exact: true }).click();
  await selectOption(
    page.getByRole('combobox', { name: 'Jogador que sai · troca 1', exact: true }),
    { index: 1 },
  );
  await selectOption(
    page.getByRole('combobox', { name: 'Jogador que entra · troca 1', exact: true }),
    { index: 1 },
  );
  await selectOption(
    page.getByRole('combobox', { name: 'Quando trocar · troca 1', exact: true }),
    '80',
  );
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect(page.locator('.planned-inline-row')).toHaveCount(1);
  await expect(
    page.getByRole('combobox', { name: 'Quando trocar · troca 1', exact: true }),
  ).toHaveText('Aos 80′');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.locator('.planned-inline-row').evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Remover troca 1', exact: true }).click();
  await expect(page.locator('.planned-inline-row')).toHaveCount(0);
});
