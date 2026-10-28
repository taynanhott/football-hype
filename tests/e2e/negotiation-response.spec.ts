import { expect, test } from '@playwright/test';

test('recebe respostas incrementais a propostas consecutivas e mantém a conversa ao reconectar', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  const budget = page.getByRole('slider', {
    name: 'Dividir orçamento entre salários e compras',
    exact: true,
  });
  await expect(budget).toBeEnabled();
  await budget.fill('0');
  await budget.dispatchEvent('pointerup');
  await expect(budget).toBeEnabled();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Série A', exact: true }).click();
  await page.locator('.market-player .negotiate-button:enabled').first().click();
  await page.getByRole('slider', { name: 'Valor da proposta', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
  await expect(page.locator('.chat-exchange')).toHaveCount(1);
  await expect(page.locator('.chat-typing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
  await expect(page.locator('.chat-exchange')).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Série A', exact: true }).click();
  await page.locator('.market-player .negotiate-button:enabled').first().click();
  await expect(page.locator('.chat-exchange')).toHaveCount(2);
});
