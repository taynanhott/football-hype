import { expect, test } from '@playwright/test';
test('ações compactas, jogador próprio no mercado e abas de estruturas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  const playerName = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState(),
      state = store.snapshot.state;
    const own = state.participants.find(
      (p: { userId: string }) => p.userId === store.userId,
    ).clubId;
    return state.players.byId[state.clubs.byId[own].playerIds[0]].name;
  });
  await page.locator('.squad-planning-list-row').first().click();
  const modal = page.getByRole('dialog');
  for (const name of ['Efeitos', 'Contrato', 'Transferências']) {
    await modal.getByRole('button', { name, exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible();
    expect((await modal.boundingBox())!.height).toBeLessThanOrEqual(800);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByPlaceholder('Nome ou sobrenome…').fill(playerName);
  await page.getByPlaceholder('Nome ou sobrenome…').press('Enter');
  const own = page
    .locator('.market-league-offers > .incoming-offer')
    .filter({ has: page.getByRole('button', { name: 'Seu jogador', exact: true }) })
    .first();
  await expect(own.getByRole('button', { name: 'Seu jogador', exact: true })).toBeDisabled();
  await expect(own.locator('.market-favorite-action')).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['training', 'stadium']) {
    await page.evaluate((route) => {
      location.hash = '/' + route;
    }, route);
    const tabs = page.locator('.facility-mobile-tabs');
    await expect(tabs).toBeVisible();
    await tabs.getByRole('tab').nth(1).click();
    await expect(tabs.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.facility-grid > .facility-card:visible')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
