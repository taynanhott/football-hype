import { expect, test } from '@playwright/test';

test('consulta os cinco níveis de estádio e gramado sem comprar melhorias', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Estádio', exact: true }).click();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  const before = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const state = store.snapshot.state;
    const id = state.participants.find((p: { userId: string }) => p.userId === store.userId).clubId;
    const club = state.clubs.byId[id];
    return { cash: club.balance.cents, stadium: state.stadiums.byId[club.stadiumId] };
  });
  for (const name of ['Estrutura do Estádio', 'Gramado']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Ver bônus de ' + name + ' por nível' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.facility-bonus-level')).toHaveCount(5);
    await expect(dialog.getByText(/Manutenção:/)).toHaveCount(5);
    await page.screenshot({
      path: 'test-results/bonus-' + (name === 'Gramado' ? 'pitch' : 'stadium') + '.png',
    });
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
  const after = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const state = store.snapshot.state;
    const id = state.participants.find((p: { userId: string }) => p.userId === store.userId).clubId;
    const club = state.clubs.byId[id];
    return { cash: club.balance.cents, stadium: state.stadiums.byId[club.stadiumId] };
  });
  expect(after).toEqual(before);
});
