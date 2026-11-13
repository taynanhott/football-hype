import { expect, test } from '@playwright/test';
test('escalações salvas e menus de instruções funcionam no computador e celular', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await page.getByRole('button', { name: /ESCALAÇÕES SALVAS/ }).click();
  await expect(page.getByRole('button', { name: '+ Salvar atual', exact: true })).toBeVisible();
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const kind of ['Estilo', 'Formação']) {
      const control = page.getByRole('combobox', { name: new RegExp('^' + kind + ':') }).first();
      await control.click();
      const list = page.getByRole('listbox').filter({ visible: true });
      await expect(list.getByRole('option')).toHaveCount(kind === 'Estilo' ? 8 : 16);
      const bounds = (await list.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await list
        .getByRole('option', {
          name: kind === 'Estilo' ? 'Avanço pelas pontas' : '4-3-3',
          exact: true,
        })
        .click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
