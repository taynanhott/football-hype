import { expect, test } from '@playwright/test';
test('padroniza os modais e oferece empréstimo ou compra na conversa', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.evaluate(() => {
    location.hash = '/squad';
  });
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.locator('.squad-planning-list-row').first().click();
  const roster = page.getByRole('dialog');
  const frame = await roster.boundingBox();
  const back = roster.getByRole('button', { name: 'Fechar', exact: true });
  expect((await back.boundingBox())!.y).toBeGreaterThan(frame!.y + frame!.height - 90);
  await page.screenshot({ path: 'test-results/transfer-layout-desktop.png' });
  await back.click();
  await page.evaluate(() => {
    location.hash = '/market';
  });
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const filters = page.getByRole('dialog');
  const second = await filters.boundingBox();
  expect(second!.width).toBeGreaterThan(frame!.width);
  expect(second!.height).toBeGreaterThan(frame!.height);
  await filters.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(filters).toHaveCount(0);
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState(),
      snapshot = store.snapshot,
      state = snapshot.state;
    const own = state.participants.find(
      (p: { userId: string }) => p.userId === store.userId,
    ).clubId;
    const seller = (Object.values(state.clubs.byId) as { id: string; playerIds: string[] }[]).find(
      (c) => c.id !== own,
    )!;
    const original = state.players.byId[seller.playerIds.at(-1)!];
    const player = { ...original, overall: 40, potential: 42, age: 28, position: 'ST' };
    useGameStore.setState({
      snapshot: {
        ...snapshot,
        state: {
          ...state,
          players: { ...state.players, byId: { ...state.players.byId, [player.id]: player } },
          management: {
            ...state.management,
            contracts: {
              ...state.management?.contracts,
              [player.id]: state.lastProcessedAt + 3 * 365 * 86400000,
            },
          },
        },
      },
    });
    location.hash = '/market?player=' + player.id;
  });
  await page
    .locator('dialog.player-detail-modal')
    .getByRole('button', { name: 'Voltar', exact: true })
    .click();
  await page
    .locator('.market-list-negotiate,.negotiate-button')
    .filter({ hasText: /Negociar|Iniciar negociação/ })
    .first()
    .click();
  const chat = page.locator('dialog.negotiation-chat-dialog');
  await expect(chat.locator('.chat-deal-options')).toBeVisible({ timeout: 10000 });
  const third = await chat.boundingBox();
  expect(third!.width).toBe(second!.width);
  expect(third!.height).toBe(second!.height);
  await chat.getByRole('button', { name: 'Empréstimo', exact: true }).click();
  await expect(chat.getByRole('slider', { name: 'Percentual do salário' })).toBeVisible();
  await expect(chat.getByRole('button', { name: '6 meses', exact: true })).toBeVisible();
  await expect(chat.getByRole('button', { name: '1 temporada', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/negotiation-options-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const offerBounds = await chat
    .getByRole('button', { name: 'Oferecer empréstimo', exact: true })
    .boundingBox();
  const returnBounds = await chat
    .getByRole('button', { name: 'Voltar', exact: true })
    .boundingBox();
  expect(offerBounds!.y + offerBounds!.height).toBeLessThan(returnBounds!.y);
  await page.screenshot({ path: 'test-results/negotiation-options-mobile.png' });
  expect(
    await chat
      .getByRole('button', { name: 'Voltar', exact: true })
      .evaluate((el) => el.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(844);
  await chat.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(chat).toHaveCount(0);
});
