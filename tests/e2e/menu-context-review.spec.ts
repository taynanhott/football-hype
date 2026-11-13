import { expect, test } from '@playwright/test';
import type { GameSnapshot } from '../../packages/shared/src/index';

test('abre cada menu mobile e pagina o livro financeiro com carreira isolada', async ({ page }) => {
  test.setTimeout(90000);
  const { createWorld } = await import('../../packages/domain/dist/index.js');
  const initial = createWorld({
    id: '00000000-0000-4000-8000-000000000017',
    userId: '00000000-0000-4000-8000-000000000018',
    name: 'Revisão dos menus',
    mode: 'offline',
    now: Date.UTC(2026, 0, 11),
  });
  if (!initial.ok) throw new Error('Falha ao preparar carreira isolada');
  const state = initial.value;
  const clubId = state.participants[0]!.clubId;
  const snapshot: GameSnapshot = {
    state,
    tables: {},
    ledger: Array.from({ length: 45 }, (_, index) => ({
      id: `entry-${index}`,
      sequence: index + 1,
      occurredAt: 1,
      gameOccurredAt: 1,
      actorId: state.administratorId,
      type: 'round.played',
      amount: -100,
      message: `Lançamento ${index}: manutenção das instalações e pagamento integral da folha salarial do clube.`,
      balances: { [clubId]: -100 },
    })),
    roomId: state.id,
  };
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.route('**/api/leagues/**/profile', (route) => route.fulfill({ json: {} }));
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async (snapshot) => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const tablesPath = '/src/store/local-tables.ts';
    const { localTables } = await import(tablesPath);
    useGameStore.setState({
      snapshot: { ...snapshot, tables: localTables(snapshot.state) },
      userId: snapshot.state.administratorId,
      connected: true,
      busy: false,
    });
  }, snapshot);
  for (const [route, selector] of [
    ['dashboard', '.football-dashboard'],
    ['squad', '.squad-office'],
    ['lineup', '.lineup-editor'],
    ['finance', '.finance-equal-columns'],
    ['market', '.transfer-hub'],
    ['news', '.twitter-news'],
    ['calendar', '.competition-controls'],
    ['stadium', '.stadium-page'],
    ['training', '.training-page'],
    ['matches', '.matches-empty'],
    ['trophies', '.trophy-gallery'],
    ['settings', '.management-invites'],
  ]) {
    await page.evaluate(async (route) => {
      if (route === 'settings') {
        const path = '/src/store/game-store.ts';
        const { useGameStore } = await import(path);
        const snapshot = useGameStore.getState().snapshot;
        useGameStore.setState({
          snapshot: { ...snapshot, state: { ...snapshot.state, mode: 'multiplayer' } },
        });
      }
      location.hash = `/${route}`;
    }, route);
    await expect(page.locator(selector!)).toBeVisible();
    if (route === 'market') {
      const filters = page.locator('.market-expand-toggle');
      await filters.click();
      await page.evaluate(() => window.scrollTo(0, 200));
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      await filters.dispatchEvent('click');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              scrollY +
              [...document.querySelectorAll('.workspace, .main-content')].reduce(
                (total, element) => total + element.scrollTop,
                0,
              ),
          ),
        )
        .toBe(0);
    }
  }
  await page.evaluate(() => {
    location.hash = '/finance';
  });
  await page.locator('.ledger-leather-cover').click();
  const modal = page.locator('.ledger-book-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.agenda-table tbody tr:not(.agenda-empty-row)')).not.toHaveCount(0);
  await modal.getByRole('button', { name: 'Virar para a próxima página' }).click();
  await expect(modal.locator('.agenda-pages')).toHaveAttribute('aria-busy', 'false');
  expect(errors).toEqual([]);
});
