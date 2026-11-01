import { expect, test } from '@playwright/test';

test('salva disponibilidade imediatamente e ocupa a tela no mobile', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada', {
    timeout: 20000,
  });
  await page.evaluate(() => {
    location.hash = '/squad';
  });
  await expect(page.locator('.squad-notebook')).toHaveCount(0);
  const row = page.locator('.squad-office-player').first();
  await row.getByRole('button', { name: 'Transferências', exact: true }).click();
  await row.getByRole('radio', { name: 'Pôr no mercado', exact: true }).check();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada', {
    timeout: 20000,
  });
  await page.evaluate(() => {
    location.hash = '/finance';
  });
  await expect(page.locator('.finance-hub')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/squad';
  });
  await row.getByRole('button', { name: 'Transferências', exact: true }).click();
  await expect(row.getByRole('radio', { name: 'Pôr no mercado', exact: true })).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.squad-card-category').first().click();
  await page
    .locator('.squad-mobile-action-buttons')
    .first()
    .getByRole('button', { name: 'Transferências', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const bounds = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
  });
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.w).toBe(bounds.vw);
  expect(bounds.h).toBe(bounds.vh);
  const close = dialog.getByRole('button', { name: 'Fechar', exact: true });
  expect(await close.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(340);
  expect(await close.evaluate((el) => el.getBoundingClientRect().bottom)).toBeGreaterThan(780);
  await page.screenshot({ path: 'test-results/transfer-update-mobile.png' });
  await close.click();
  const nav = page.getByRole('navigation', { name: 'Atalhos de navegação' });
  const widths = await nav
    .locator('a,button')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  const navWidth = await nav.evaluate((el) => el.getBoundingClientRect().width);
  for (const width of widths) expect(width).toBeCloseTo(navWidth / 3, 0);
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  await page.getByRole('button', { name: 'Análise tática', exact: true }).click();
  await expect(page.locator('.tactical-analysis-group.strong')).toBeVisible();
  await expect(page.locator('.tactical-analysis-group.weak')).toBeHidden();
  await page.getByRole('tab', { name: 'Contras', exact: true }).click();
  await expect(page.locator('.tactical-analysis-group.weak')).toBeVisible();
  await expect(page.locator('.tactical-analysis-group.strong')).toBeHidden();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.evaluate(() => {
    location.hash = '/market';
  });
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filtrar jogadores' });
  await expect(filters).toBeVisible();
  expect(await filters.evaluate((el) => el.getBoundingClientRect().width)).toBe(390);
  expect(
    await filters
      .getByRole('button', { name: 'Voltar', exact: true })
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(340);
  await filters.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.clock.install();
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const snapshot = store.snapshot;
    const state = snapshot.state;
    const ownId = state.participants.find(
      (p: { userId: string }) => p.userId === store.userId,
    ).clubId;
    const fixture = state.fixtures.find(
      (f: { homeId: string; awayId: string }) => f.homeId === ownId || f.awayId === ownId,
    );
    const home: string[] = state.clubs.byId[fixture.homeId].playerIds.slice(0, 11);
    const away: string[] = state.clubs.byId[fixture.awayId].playerIds.slice(0, 11);
    const result = {
      fixtureId: fixture.id,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      stadiumId: state.clubs.byId[fixture.homeId].stadiumId,
      status: 'finished',
      homeGoals: 1,
      awayGoals: 0,
      startedAt: Date.now() + store.clockOffset,
      attendance: 1000,
      revenue: 1000000,
      seed: 1,
      scorers: [],
      ratings: Object.fromEntries([...home, ...away].map((id) => [id, 7])),
      lineups: { home, away },
      tacticalPlans: {
        home: { formation: '4-3-3', starters: home, style: 'balanced' },
        away: { formation: '4-3-3', starters: away, style: 'balanced' },
      },
    };
    useGameStore.setState({ snapshot: { ...snapshot, state: { ...state, results: [result] } } });
    location.hash = '/dashboard';
  });
  await expect(page).toHaveURL(/#\/matches$/);
  await page.evaluate(() => {
    location.hash = '/dashboard';
  });
  await expect(page.locator('.club-calendar')).toBeVisible();
  await expect(page.locator('.club-calendar-score')).toHaveCount(0);
  await page.clock.fastForward(96000);
  await expect(page.locator('.club-calendar-score')).toHaveCount(1);
  await page.evaluate(() => {
    location.hash = '/matches';
  });
  await page.getByRole('tab', { name: 'Notas dos jogadores', exact: true }).click();
  await expect(page.locator('.ratings-half')).toHaveCount(2);
  const vertical = await page.locator('.ratings-pitch').evaluate((el) => {
    const home = el.querySelector('.ratings-half-home')!.getBoundingClientRect();
    const away = el.querySelector('.ratings-half-away')!.getBoundingClientRect();
    return away.top >= home.bottom - 1;
  });
  expect(vertical).toBe(true);
  await page.screenshot({ path: 'test-results/match-ratings-update-mobile.png', fullPage: true });
});
