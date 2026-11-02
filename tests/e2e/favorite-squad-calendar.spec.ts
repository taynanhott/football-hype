import { expect, test } from '@playwright/test';

test('favoritos neutros, propostas contidas e calendário compacto no desktop', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page
    .locator('.club-calendar-day.match-day')
    .filter({ has: page.locator('.club-calendar-event') })
    .first()
    .click({ position: { x: 3, y: 3 } });
  const details = page.locator('.game-details-modal');
  await expect(details).toBeVisible();
  expect((await details.boundingBox())!.height).toBeLessThan(650);
  expect(await details.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  await page.screenshot({ path: '.test-temp/calendar-desktop-final.png' });
  await details.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.evaluate(() => {
    location.hash = '/squad';
  });
  await page.getByRole('button', { name: 'Cartas', exact: true }).click();
  const category = page.locator('.squad-card-category').first();
  if ((await category.getAttribute('aria-expanded')) !== 'true') await category.click();
  const card = page.locator('.squad-office-player:visible').first();
  await card.getByRole('checkbox', { name: 'No mercado', exact: true }).check();
  const loan = card.getByRole('button', { name: /Disponível para empréstimo/ });
  if (await loan.isEnabled()) await loan.click();
  const bounds = await card.boundingBox();
  const proposal = await card.locator('.player-policy-offers').boundingBox();
  expect(proposal!.y + proposal!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height - 5);
  await page.screenshot({ path: '.test-temp/squad-proposal-final.png' });
  await page.evaluate(() => {
    location.hash = '/market';
  });
  await page.getByRole('button', { name: 'Cartas', exact: true }).click();
  const favorite = page.locator('.market-favorite-action:not(:disabled)').first();
  await expect(favorite).toBeVisible();
  expect(await favorite.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain(
    '243, 237, 207',
  );
  await favorite.click();
  await page.mouse.move(0, 0);
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  expect(await favorite.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain(
    '241, 217, 143',
  );
});
