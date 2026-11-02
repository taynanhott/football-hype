import { expect, test } from '@playwright/test';

test('cabeçalho legível no empréstimo e listas de táticas nas duas abas', async ({ page }) => {
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const { snapshot } = useGameStore.getState(),
      { state } = snapshot;
    const owner = state.participants[0].clubId;
    const buyer = (Object.values(state.clubs.byId) as { id: string }[]).find(
      (c) => c.id !== owner,
    )!;
    useGameStore.setState({
      snapshot: {
        ...snapshot,
        state: {
          ...state,
          management: {
            ...state.management,
            offers: [
              {
                id: 'loan-preview',
                playerId: state.clubs.byId[owner].playerIds[0],
                sellerId: owner,
                buyerId: buyer.id,
                kind: 'loan',
                months: 6,
                salaryPercent: 100,
                salary: 660000,
                fee: 0,
                status: 'pending',
                offeredAt: state.lastProcessedAt,
              },
            ],
          },
        },
      },
    });
    location.hash = '/market?tab=proposals';
  });
  const header = page.locator('.loan-offer .offer-buyer');
  await expect(header).toBeVisible();
  expect(await header.locator('a').evaluate((e) => getComputedStyle(e).color)).toBe(
    'rgb(18, 59, 84)',
  );
  await page.screenshot({ path: 'test-results/loan-header-readable-mobile.png' });
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await expect(page.locator('.tactics-field')).toBeVisible();
  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(size);
    await expect(async () => {
      const bounds = await page.locator('.tactics-field').boundingBox();
      const nav = await page.locator('.mobile-bottom-nav').boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y);
      expect(bounds!.height).toBeLessThanOrEqual(bounds!.width * 1.6 + 1);
      await expect(page.locator('.lineup-club-summary')).toBeInViewport();
      await expect(page.locator('.tactics-chemistry')).toHaveCount(0);
      const cards = await page.locator('.tactics-player').evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        }),
      );
      expect(cards).toHaveLength(11);
      for (const card of cards) {
        expect(card.top).toBeGreaterThanOrEqual(0);
        expect(card.bottom).toBeLessThanOrEqual(nav!.y);
      }
      const overlapping = await page.locator('.tactics-player').evaluateAll((elements) => {
        const boxes = elements.map((element) => {
          const card = element.getBoundingClientRect();
          const modifier = element.querySelector('.overall-modifier')?.getBoundingClientRect();
          return {
            left: card.left,
            right: card.right,
            top: Math.min(card.top, modifier?.top ?? card.top),
            bottom: card.bottom,
          };
        });
        return boxes.some((a, i) =>
          boxes
            .slice(i + 1)
            .some(
              (b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
            ),
        );
      });
      if (overlapping) await page.screenshot({ path: 'test-results/bench-overlap.png' });
      expect(overlapping).toBe(false);
    }).toPass();
  }
  for (const kind of ['related', 'unrelated']) {
    const section = page.locator(`.reserve-section.${kind}`);
    await expect(section).not.toHaveAttribute('open', '');
    await section.locator('summary').click();
    await expect(section).toHaveAttribute('open', '');
    expect(
      await section
        .locator('.reserve-cards')
        .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
    ).toBe(true);
    await section.locator('summary').click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/lineup-fit-mobile.png' });
  await page.getByRole('button', { name: 'Análise tática', exact: true }).click();
  for (const name of ['Prós', 'Contras']) {
    await page.getByRole('tab', { name, exact: true }).click();
    const list = page.getByRole('tabpanel');
    expect(await list.locator('.tactical-matchup-group').count()).toBeGreaterThan(0);
    expect(await list.locator('li').count()).toBeGreaterThan(0);
    await expect(list).not.toContainText('titulares estão adaptados');
    await page.screenshot({
      path: `test-results/tactical-${name === 'Prós' ? 'pros' : 'cons'}-mobile.png`,
    });
  }
});
