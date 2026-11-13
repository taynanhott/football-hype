import { test, expect } from '@playwright/test';

test('salva limites financeiros e aplica a verba salarial no mercado', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  const budget = page.getByRole('slider', { name: 'Dividir orçamento entre salários e compras' });
  await expect(budget).toBeEnabled();
  await budget.fill('0');
  await budget.dispatchEvent('pointerup');
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  const playerId = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const player = (
      Object.values(store.snapshot.state.players.byId) as {
        id: string;
        clubId: string | null;
        academyClubId?: string;
      }[]
    ).find(
      (p: { clubId: string | null; academyClubId?: string }) =>
        p.clubId === null && !p.academyClubId,
    ) as { id: string };
    store.send({ type: 'sign-free', playerId: player.id, salary: 5000 });
    return player.id;
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = '/src/store/game-store.ts';
        const { useGameStore } = await import(path);
        return useGameStore.getState().error;
      }),
    )
    .toContain('orçamento');
  expect(
    await page.evaluate(async (id) => {
      const path = '/src/store/game-store.ts';
      const { useGameStore } = await import(path);
      return useGameStore.getState().snapshot.state.players.byId[id].clubId;
    }, playerId),
  ).toBeNull();
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await expect(budget).toHaveValue('0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
