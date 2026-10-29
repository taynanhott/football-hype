import { expect, test } from '@playwright/test';

test('ações respondem localmente e são confirmadas em ordem pela sala', async ({ page }) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toHaveText('✓ Carreira sincronizada', {
    timeout: 20000,
  });
  const instant = await page.evaluate(async () => {
    const modulePath = '/src/store/game-store.ts';
    const { useGameStore } = await import(modulePath);
    const before = useGameStore.getState();
    const clubId = before.snapshot.state.participants.find(
      (member: { userId: string }) => member.userId === before.userId,
    ).clubId;
    before.send({ type: 'home-ticket-price', priceCents: 5000 });
    before.send({ type: 'home-ticket-price', priceCents: 7500 });
    const after = useGameStore.getState();
    return {
      price: after.snapshot.state.homeTicketPrices[clubId],
      busy: after.busy,
      pending: after.pendingActions,
    };
  });
  expect(instant).toEqual({ price: 7500, busy: false, pending: 2 });
  await expect(page.locator('.save-queue-status')).toHaveText('✓ Carreira sincronizada');
  await page.reload();
  await page.locator('.saved-leagues button').first().click();
  await expect(page.locator('.save-queue-status')).toHaveText('✓ Carreira sincronizada', {
    timeout: 20000,
  });
  const persisted = await page.evaluate(async () => {
    const modulePath = '/src/store/game-store.ts';
    const { useGameStore } = await import(modulePath);
    const current = useGameStore.getState();
    const clubId = current.snapshot.state.participants.find(
      (member: { userId: string }) => member.userId === current.userId,
    ).clubId;
    return current.snapshot.state.homeTicketPrices[clubId];
  });
  expect(persisted).toBe(7500);
  const beforeRound = await page.evaluate(async () => {
    const modulePath = '/src/store/game-store.ts';
    const { useGameStore } = await import(modulePath);
    const state = useGameStore.getState().snapshot.state;
    return { round: state.round, nextScheduledAt: state.nextScheduledAt };
  });
  await page.getByRole('button', { name: 'Avançar rodada', exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const modulePath = '/src/store/game-store.ts';
        const { useGameStore } = await import(modulePath);
        return useGameStore.getState().snapshot.state.round;
      }),
    )
    .toBe(beforeRound.round + 1);
  await expect(page.locator('.save-queue-status')).toHaveText('✓ Carreira sincronizada');
  const searches: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/players?')) searches.push(request.url());
  });
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  await page.getByPlaceholder('Nome ou sobrenome…').fill('Caio');
  await page.getByPlaceholder('Nome ou sobrenome…').press('Enter');
  await expect(page.locator('.market-player').first()).toContainText(/Caio/i);
  expect(searches).toEqual([]);
  expect(errors).toEqual([]);
});
