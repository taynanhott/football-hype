import { expect, test } from '@playwright/test';
test('planeja trocas, persiste regras e mantém modais compactos', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await page.getByRole('button', { name: '+ Planejar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.match-plan-modal .bench-player:not(:disabled)').first().click();
  await page.locator('.match-plan-modal .bench-player:not(:disabled)').first().click();
  await page.getByRole('button', { name: 'Aos 90′', exact: true }).click();
  await page.getByRole('button', { name: 'Sempre', exact: true }).click();
  await expect(page.locator('.planned-swap')).toHaveCount(1);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path = '/src/store/game-store.ts';
        const { useGameStore } = await import(path);
        const state = useGameStore.getState().snapshot.state;
        const clubId = state.participants[0].clubId;
        return state.tactics[clubId]?.instructions?.substitutions.length ?? 0;
      }),
    )
    .toBe(1);
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.evaluate(() => {
    location.hash = '/squad';
  });
  await expect(page.locator('.planned-swap')).toHaveCount(0);
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await expect(page.locator('.planned-swap')).toContainText('Aos 90′');
  await page.locator('.unavailable-players summary').click();
  await expect(page.locator('.unavailable-players')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: '+ Planejar', exact: true }).click();
  const modal = page.locator('.match-plan-modal');
  await expect(modal).toBeVisible();
  const bounds = await modal.boundingBox();
  expect(bounds!.height).toBeLessThan(720);
  await page.screenshot({ path: 'test-results/match-instructions-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modal).toBeVisible();
  await page.screenshot({ path: 'test-results/match-instructions-mobile.png' });
});
