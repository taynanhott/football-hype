import { expect, test } from '@playwright/test';
test('preserva a resposta salarial e a conversa ao reconectar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Livres', exact: true }).click();
  const first = page
    .locator('.market-league-offers > .incoming-offer')
    .filter({ has: page.getByRole('button', { name: /Iniciar negociação/ }) })
    .first();
  const name = await first.locator('.market-player-name-trigger').innerText();
  await first.getByRole('button', { name: /Iniciar negociação/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('slider', { name: 'Oferta salarial', exact: true }).fill('5000');
  await dialog.getByRole('button', { name: /Enviar minha proposta/ }).click();
  await expect(dialog.locator('.market-player-speech')).toContainText(/valor final|Quero/);
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.reload();
  await page.locator('.career-save-open').first().click();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Livres', exact: true }).click();
  await page.getByPlaceholder('Nome ou sobrenome…').fill(name);
  await page.getByPlaceholder('Nome ou sobrenome…').press('Enter');
  await page
    .locator('.market-league-offers > .incoming-offer')
    .first()
    .getByRole('button', { name: /Iniciar negociação/ })
    .click();
  await expect(dialog.locator('.market-player-speech')).toContainText(/valor final|Quero/);
});
