import { expect, test } from '@playwright/test';

test('escalações salvas recolhem e preservam os controles no celular e desktop', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await page.getByRole('button', { name: /ESCALAÇÕES SALVAS/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '+ Salvar atual', exact: true }).click();
    await page.locator('#preset-name').fill(`Time ${i + 1}`);
    await page.getByRole('button', { name: 'Salvar preset atual', exact: true }).click();
    await expect(page.locator('.lineup-preset')).toHaveCount(i + 1);
  }
  const support = page.locator('.lineup-support');
  await expect(support.locator('.sector-chemistry')).toHaveCount(1);
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.lineup-preset')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const toggle = page.getByRole('button', { name: /ESCALAÇÕES SALVAS/ });
    await toggle.click();
    await expect(page.locator('.lineup-presets-body')).toBeHidden();
    await toggle.click();
    await expect(page.locator('.lineup-presets-body')).toBeVisible();
    await page.getByRole('button', { name: /Não substituir ·/ }).click();
    const modal = page.getByRole('dialog', { name: 'Não substituir', exact: true });
    await expect(modal).toBeVisible();
    await modal.locator('.bench-player:not(:disabled)').first().click();
    await page
      .getByRole('button', { name: /Remover proteção de/ })
      .first()
      .click();
  }
});
