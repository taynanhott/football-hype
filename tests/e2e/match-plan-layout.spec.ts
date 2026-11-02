import { expect, test } from '@playwright/test';

test('formulário ocupa a linha, proteção ocupa terços e planejamentos excluem protegidos', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await page.getByRole('button', { name: '+ Salvar atual', exact: true }).click();
  const form = page.locator('.preset-name-form');
  const label = (await form.locator('label').boundingBox())!;
  const input = (await form.locator('input').boundingBox())!;
  const save = (await form.locator('button').first().boundingBox())!;
  const cancel = (await form.getByRole('button', { name: 'Cancelar', exact: true }).boundingBox())!;
  expect(label.y + label.height).toBeLessThanOrEqual(input.y);
  expect(input.y + input.height).toBeLessThanOrEqual(save.y);
  expect(save.y + save.height).toBeLessThanOrEqual(cancel.y);
  expect(save.width).toBeCloseTo(input.width, 0);
  expect(cancel.width).toBeCloseTo(input.width, 0);
  expect(
    await form
      .getByRole('button', { name: 'Cancelar', exact: true })
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain('169, 76, 71');
  await page.screenshot({ path: '.test-temp/preset-form-full-width.png' });
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const protectedNames: string[] = [];
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /Não substituir ·/ }).click();
    const modal = page.getByRole('dialog', { name: 'Não substituir', exact: true });
    const player = modal.locator('.bench-player:not(:disabled)').first();
    protectedNames.push((await player.locator('strong').textContent())!);
    await player.click();
  }
  const widths = await page.locator('.protected-players').evaluate((e) => ({
    full: e.getBoundingClientRect().width,
    buttons: Array.from(e.querySelectorAll('button')).map((b) => b.getBoundingClientRect().width),
  }));
  expect(widths.buttons).toHaveLength(3);
  for (const width of widths.buttons) expect(width).toBeCloseTo((widths.full - 12) / 3, 0);
  await page.getByRole('button', { name: '+ Planejar', exact: true }).click();
  const plan = page.locator('.match-plan-modal');
  await expect(plan.locator('.match-plan-steps')).toHaveCount(0);
  for (const name of protectedNames)
    await expect(plan.getByText(name, { exact: true })).toHaveCount(0);
  const outgoing = plan.locator('.bench-player:not(:disabled)').first();
  const outgoingName = (await outgoing.locator('strong').textContent())!;
  await outgoing.click();
  await plan.locator('.bench-player:not(:disabled)').first().click();
  const fatigue = plan.getByRole('button', { name: "Por cansaço, após 60'", exact: true });
  await expect(fatigue).toBeVisible();
  expect((await plan.locator('.match-plan-options').boundingBox())!.height).toBeGreaterThan(300);
  await page.screenshot({ path: '.test-temp/when-to-swap-filled.png' });
  await fatigue.click();
  await plan.getByRole('button', { name: 'Sempre', exact: true }).click();
  await expect(page.locator('.planned-swap')).toContainText("Por cansaço, após 60'");
  await page.locator('.planned-heading').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-temp/protected-thirds-planned-heading.png' });
  await page.getByRole('button', { name: /Não substituir ·/ }).click();
  await expect(page.getByRole('dialog').getByText(outgoingName, { exact: true })).toHaveCount(0);
});
