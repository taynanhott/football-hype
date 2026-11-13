import { expect, test } from '@playwright/test';

test('calendário cabe no mobile e noticiário rola com os controles', async ({ page }) => {
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
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const { snapshot } = store;
    const { state } = snapshot;
    const ownId = state.participants.find(
      (p: { userId: string }) => p.userId === store.userId,
    ).clubId;
    const newsPlayers = (
      Object.values(state.players.byId) as { id: string; clubId: string | null }[]
    ).filter((p: { clubId: string | null }) => p.clubId && p.clubId !== ownId) as {
      id: string;
      clubId: string;
    }[];
    useGameStore.setState({
      snapshot: {
        ...snapshot,
        state: {
          ...state,
          negotiations: Array.from({ length: 40 }, (_, i) => ({
            id: 'news-' + i,
            playerId: newsPlayers[i]!.id,
            buyerId: ownId,
            sellerId: newsPlayers[i]!.clubId,
            fee: 100000,
            interest: 50,
            status: 'review',
            offeredAt: state.lastProcessedAt - i * 1000,
            expiresAt: state.lastProcessedAt + 86400000,
          })),
        },
      },
    });
    location.hash = '/news';
  });
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const feed = page.locator('.transfer-news-feed');
    await expect(feed.locator('.transfer-news-item')).toHaveCount(20);
    const navBefore = await page.locator('.news-left-nav').boundingBox();
    const searchBefore = await page.locator('.news-search').boundingBox();
    await feed.hover();
    await page.mouse.wheel(0, 600);
    const mobile = viewport.width <= 760;
    const scroller = mobile ? page.locator('.transfer-news-page') : feed;
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    const navAfter = (await page.locator('.news-left-nav').boundingBox())!;
    expect(navAfter.y).toBe(navBefore!.y);
    if (mobile) {
      const searchAfter = (await page.locator('.news-search').boundingBox())!;
      expect(searchAfter.y).toBeLessThan(searchBefore!.y);
      expect(searchAfter.y + searchAfter.height).toBeLessThanOrEqual(navAfter.y);
    }
    await page.screenshot({ path: `test-results/news-scroll-${viewport.width}.png` });
  }
  await page.evaluate(() => {
    location.hash = '/dashboard';
  });
  await page.locator('.club-calendar-event').first().click();
  const modal = page.locator('.game-details-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/Força da torcida/)).toHaveCount(0);
  await expect(modal.locator('.game-details-team-overall')).toHaveCount(2);
  await expect(modal.locator('.game-details-team-overall small')).toHaveCount(0);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.height === 844) expect((await modal.boundingBox())!.height).toBeLessThan(650);
    expect(await modal.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    const back = await modal.getByRole('button', { name: 'Voltar', exact: true }).boundingBox();
    expect(back!.y + back!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      animations: 'disabled',
      path: `test-results/calendar-compact-${viewport.width}.png`,
    });
  }
});
