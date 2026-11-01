import { expect, test } from '@playwright/test';

test('mantém atributos na carta e separa nome, retrato e condição dos reservas', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.evaluate(() => {
    location.hash = '/squad';
  });
  const card = page.locator('.squad-office-player .player-card').first();
  await card.click();
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width < 761) await page.locator('.squad-card-category').first().click();
    await card.scrollIntoViewIfNeeded();
    expect(
      await card
        .locator('.card-back')
        .evaluate((el) =>
          Array.from(el.querySelectorAll('dt,dd')).every(
            (cell) => cell.scrollWidth <= cell.clientWidth + 1,
          ),
        ),
    ).toBe(true);
    await card.screenshot({ path: `test-results/roster-card-${viewport.width}.png` });
  }
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await expect(page.locator('.reserve-mini').first()).toBeVisible();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const overlap = await page.locator('.reserve-mini').evaluateAll((cards) =>
      cards.some((card) => {
        const portrait = card
          .querySelector('.reserve-mini-portrait .portrait')!
          .getBoundingClientRect();
        const name = card.querySelector('strong')!.getBoundingClientRect();
        const fitness = card.querySelector('.reserve-mini-fitness')!.getBoundingClientRect();
        return name.top < portrait.bottom || name.bottom > fitness.top;
      }),
    );
    expect(overlap).toBe(false);
    await page
      .locator('.reserve-cards')
      .first()
      .screenshot({ path: `test-results/reserve-cards-${viewport.width}.png` });
  }
});
