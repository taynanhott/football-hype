import { test, expect } from '@playwright/test';

test('filtros têm prévia e só atualizam a listagem após confirmar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByRole('button', { name: 'Exterior', exact: true }).click();
  await expect(page.locator('.market-player')).toHaveCount(48);
  const open = () => page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const apply = () => page.getByRole('button', { name: /Ver resultados/ }).click();
  await open();
  const label = await page.getByRole('button', { name: /Ver resultados/ }).innerText();
  const buttonSize = await page
    .getByRole('button', { name: /Ver resultados/ })
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
  expect(Number(label.match(/\(([\d.]+)\)/)![1]!.replaceAll('.', ''))).toBeGreaterThan(48);
  await page.getByRole('slider', { name: 'Overall mínimo', exact: true }).fill('99');
  await expect(page.getByRole('button', { name: /Ver resultados/ })).toHaveText(
    '(0) Ver resultados',
  );
  expect(
    await page
      .getByRole('button', { name: /Ver resultados/ })
      .evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
  ).toEqual(buttonSize);
  await expect(page.locator('.market-player')).toHaveCount(48);
  await page.getByRole('button', { name: 'Fechar filtros' }).click();
  await open();
  await expect(page.getByRole('slider', { name: 'Overall mínimo', exact: true })).toHaveValue('1');
  await page.getByRole('slider', { name: 'Overall mínimo', exact: true }).fill('99');
  await apply();
  await expect(page.locator('.market-player')).toHaveCount(0);
  await open();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.locator('.market-player')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open();
  await expect(page.getByRole('slider', { name: 'Overall mínimo', exact: true })).toHaveValue('99');
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await apply();
  await expect(page.locator('.market-player')).toHaveCount(48);
});
