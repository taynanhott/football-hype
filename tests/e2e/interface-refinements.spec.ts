import { expect, test } from '@playwright/test';

test('ações compactas, jogador próprio no mercado, abas de estruturas e finanças', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
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
    useGameStore.setState({
      snapshot: {
        ...snapshot,
        state: {
          ...state,
          workload: Object.fromEntries(
            state.clubs.byId[owner].playerIds.map((id: string) => [
              id,
              { ...state.workload[id], consecutiveMatches: 3 },
            ]),
          ),
          management: {
            ...state.management,
            wageDebts: { [owner]: 1 },
            contracts: Object.fromEntries(
              state.clubs.byId[owner].playerIds.map((id: string) => [
                id,
                state.lastProcessedAt + 200 * 86400000,
              ]),
            ),
          },
        },
      },
    });
    location.hash = '/squad';
  });
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.locator('.squad-planning-list-row').first().click();
  const modal = page.locator('.squad-action-modal');
  await expect(modal.locator('.modal-title .official-club-badge')).toBeVisible();
  const frame = await modal.boundingBox();
  expect(frame!.height).toBeLessThan(600);
  for (const name of ['Bônus e penalidades', 'Renegociação', 'Transferências']) {
    await modal.getByRole('button', { name, exact: true }).click();
    expect((await modal.boundingBox())!.height).toBe(frame!.height);
    expect(
      await modal.locator('.modal-content').evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
    if (name === 'Bônus e penalidades') {
      await expect(modal.locator('.player-effect-list .positive')).toBeVisible();
      await expect(modal.locator('.player-effect-list .negative')).toBeVisible();
    }
  }
  await modal.getByRole('checkbox', { name: 'No mercado', exact: true }).check();
  await expect(modal.getByRole('button', { name: /Disponível para empréstimo/ })).toBeEnabled();
  await modal.getByRole('button', { name: /Disponível para empréstimo/ }).click();
  await expect(modal.getByRole('button', { name: '6 meses', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await modal.getByRole('radio').count()).toBe(0);
  await page.screenshot({ path: 'test-results/actions-compact-desktop.png' });
  const playerName = (await modal.getAttribute('aria-label'))!;
  await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.evaluate(() => {
    location.hash = '/market';
  });
  await page.getByRole('button', { name: 'Cartas', exact: true }).click();
  await page.getByPlaceholder('Nome ou sobrenome…').fill(playerName);
  const own = page
    .locator('.incoming-offer')
    .filter({ has: page.getByRole('heading', { name: playerName, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Seu jogador', exact: true }) })
    .first();
  await expect(own.locator('.negotiate-button')).toBeDisabled();
  await expect(own.locator('.market-favorite-action')).toBeDisabled();
  await expect(own.locator('.market-overall-badge')).toHaveAttribute(
    'data-tier',
    /bronze|silver|gold|diamond/,
  );
  expect(
    await own.locator('.negotiate-button').evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain('linear-gradient');
  await page.screenshot({ path: 'test-results/market-own-player-desktop.png' });
  await page.getByPlaceholder('Nome ou sobrenome…').fill('');
  const before = await page.locator('.market-league-offers > .incoming-offer').count();
  await page.locator('.market-infinite-loading').scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.locator('.market-league-offers > .incoming-offer').count())
    .toBeGreaterThan(before);
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
    expect(
      await tabs
        .getByRole('tab')
        .nth(1)
        .evaluate((e) => {
          const icon = e.querySelector('svg')!.getBoundingClientRect();
          const text = e.querySelector('span')!.getBoundingClientRect();
          return text.top < icon.bottom && text.bottom > icon.top;
        }),
    ).toBe(true);
    await page.screenshot({ path: `test-results/${route}-tabs-mobile.png` });
  }
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await expect(page.locator('.lineup-effective-average')).toHaveCount(0);
  await page.getByRole('button', { name: 'Análise tática', exact: true }).click();
  await expect(page.locator('.tactical-result-metrics')).toBeVisible();
  await page.screenshot({ path: 'test-results/tactical-summary-mobile.png' });
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    location.hash = '/finance';
  });
  await expect(page.getByText('Ver valores por mês', { exact: true })).toHaveCount(0);
  const book = page.locator('.ledger-leather-cover');
  expect(
    await page.locator('.finance-hub').evaluate((e) => e.getBoundingClientRect().bottom),
  ).toBeGreaterThan(750);
  expect(
    await book.evaluate(
      (e) => e.parentElement!.getBoundingClientRect().bottom - e.getBoundingClientRect().bottom,
    ),
  ).toBeLessThan(10);
  await page.screenshot({ path: 'test-results/finance-book-expanded-desktop.png' });
  await page.evaluate(() => {
    location.hash = '/news';
  });
  const news = page.locator('.twitter-news');
  await expect.poll(() => news.evaluate((e) => e.getBoundingClientRect().bottom)).toBe(800);
  await page.screenshot({ path: 'test-results/news-full-height-desktop.png' });
  await page.evaluate(() => {
    location.hash = '/calendar';
  });
  await expect(page.getByRole('button', { name: 'Classificação', exact: true })).toBeVisible();
  await expect(
    page.getByText('Horários de Brasília · Partidas entre 08h e 23h30', { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: 'test-results/competition-filters-desktop.png' });
});
