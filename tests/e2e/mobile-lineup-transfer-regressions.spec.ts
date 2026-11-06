import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){ return null; }',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
});

test('rola sobre a carta e permite arrastar após segurar no mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  const cards = page.locator('.tactics-player');
  await expect(cards).toHaveCount(11);
  const source = cards.nth(5);
  await source.scrollIntoViewIfNeeded();
  const box = (await source.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  const before = await page.evaluate(
    () =>
      scrollY +
      [...document.querySelectorAll('.workspace,.main-content')].reduce(
        (n, e) => n + e.scrollTop,
        0,
      ),
  );
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - step * 18 }],
    });
    await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          scrollY +
          [...document.querySelectorAll('.workspace,.main-content')].reduce(
            (n, e) => n + e.scrollTop,
            0,
          ),
      ),
    )
    .toBeGreaterThan(before);
  await expect(page.locator('.dragged-card-preview')).toHaveCount(0);
  await cards.first().click();
  const modal = page.locator('dialog.lineup-selection-modal');
  await expect(modal).toBeVisible();
  const frame = (await modal.boundingBox())!;
  const back = (await modal.locator('.modal-return').boundingBox())!;
  expect(back.x - frame.x).toBeGreaterThanOrEqual(10);
  expect(frame.y + frame.height - back.y - back.height).toBeGreaterThanOrEqual(10);
  await modal.locator('.modal-return').click();
  await source.scrollIntoViewIfNeeded();
  const start = (await source.boundingBox())!;
  const sx = start.x + start.width / 2,
    sy = start.y + start.height / 2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: sx, y: sy }],
  });
  await page.waitForTimeout(450);
  await expect(page.locator('.dragged-card-preview')).toBeVisible();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: sx + 25, y: sy + 20 }],
  });
  await expect(page.locator('.dragged-card-preview')).toBeVisible();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.dragged-card-preview')).toHaveCount(0);
});

test('aceita exigência exata de HC$ 3.800 e volta a Enviar proposta ao editar', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const modulePath = '/src/store/game-store.ts';
    const { useGameStore } = await import(modulePath);
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
    const extras = Array.from(
      { length: Math.max(0, 19 - seller.playerIds.length) },
      (_, index) => ({ ...original, id: crypto.randomUUID(), name: `Reserva extra ${index}` }),
    );
    const player = {
      ...original,
      overall: 40,
      potential: 42,
      age: 28,
      marketValue: { ...original.marketValue, cents: 500000 },
    };
    const negotiation = {
      id: crypto.randomUUID(),
      playerId: player.id,
      buyerId: own,
      sellerId: seller.id,
      status: 'rejected',
      fee: 200000,
      offeredSalary: null,
      interest: 80,
      revealed: true,
      minimumFee: 380000,
      offeredAt: state.lastProcessedAt,
      expiresAt: state.lastProcessedAt + 86400000,
      reply: 'Nosso valor é HC$ 3.800.',
    };
    useGameStore.setState({
      snapshot: {
        ...snapshot,
        state: {
          ...state,
          clubs: {
            ...state.clubs,
            byId: {
              ...state.clubs.byId,
              [seller.id]: {
                ...seller,
                playerIds: [...seller.playerIds, ...extras.map((extra) => extra.id)],
              },
            },
          },
          players: {
            ...state.players,
            ids: [...state.players.ids, ...extras.map((extra) => extra.id)],
            byId: {
              ...state.players.byId,
              [player.id]: player,
              ...Object.fromEntries(extras.map((extra) => [extra.id, extra])),
            },
          },
          debts: { ...state.debts, [seller.id]: 100000 },
          management: {
            ...state.management,
            financialPlans: {
              ...state.management?.financialPlans,
              [own]: { transfer: 1000000, salaries: 0 },
            },
          },
          negotiations: [...state.negotiations, negotiation],
        },
      },
    });
    location.hash = '/market?player=' + player.id;
  });
  const negotiate = page
    .locator('.negotiate-button,.market-list-negotiate')
    .filter({ hasText: /Negociar|Iniciar negociação/ })
    .first();
  await expect(page.locator('dialog.player-card-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await negotiate.click();
  const chat = page.locator('dialog.negotiation-chat-dialog');
  const accept = chat.getByRole('button', { name: 'Aceitar por HC$ 3.800', exact: true });
  await expect(accept).toBeEnabled({ timeout: 10000 });
  await expect(chat.getByRole('slider', { name: 'Valor da proposta' })).toHaveValue('380000');
  await chat.getByRole('slider', { name: 'Valor da proposta' }).fill('400000');
  await expect(chat.getByRole('button', { name: 'Enviar proposta', exact: true })).toBeEnabled();
  await expect(accept).toHaveCount(0);
});
