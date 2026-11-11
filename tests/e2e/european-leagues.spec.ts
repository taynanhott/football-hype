import { expect, test } from '@playwright/test';
import { selectOption } from './select-option';
import { readFileSync } from 'node:fs';
import type { WorldDataset, GameSnapshot } from '../../packages/shared/src/index';

test('consulta ligas europeias em tabela e jogos no computador e no celular', async ({ page }) => {
  test.setTimeout(120000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route('**/api/leagues/**/profile', (route) => route.fulfill({ json: {} }));
  const { createWorld, createEuropeanLeagues, advanceEuropeanLeagues, europeanRoundDate } =
    await import('../../packages/domain/dist/index.js');
  const dataset = JSON.parse(readFileSync('data/player-database.json', 'utf8')) as WorldDataset;
  const initial = createWorld({
    id: '00000000-0000-4000-8000-000000000007',
    userId: '00000000-0000-4000-8000-000000000008',
    name: 'Consulta europeia',
    mode: 'offline',
    now: Date.UTC(2026, 0, 11),
  });
  if (!initial.ok) throw new Error('Não foi possível preparar a carreira de teste');
  const club = Object.values(dataset.clubs.byId).find(
    (club) => club.country === 'BR' && club.division === 'A',
  )!;
  // UI fixture only: domain persistence/calendar/ownership are exercised by domain tests.
  const state = advanceEuropeanLeagues(
    {
      ...initial.value,
      clubs: dataset.clubs,
      players: dataset.players,
      centers: dataset.centers,
      stadiums: dataset.stadiums,
      participants: [{ userId: initial.value.administratorId, clubId: club.id, ready: false }],
      europeanLeagues: createEuropeanLeagues(Object.values(dataset.clubs.byId), 2026),
    },
    europeanRoundDate(2026, 2),
  );
  const snapshot: GameSnapshot = {
    state: {
      ...state,
      competitionNotes: { ...state.competitionNotes, 'serie-a': 'Competição nacional disponível' },
    },
    tables: {},
    ledger: [],
    roomId: state.id,
  };
  await page.goto('/');
  await page.evaluate(async (snapshot) => {
    location.hash = '/calendar?competition=premier-league';
    const modulePath = '/src/store/game-store.ts';
    const { useGameStore } = await import(modulePath);
    useGameStore.setState({
      snapshot,
      userId: snapshot.state.administratorId,
      connected: true,
      busy: false,
    });
  }, snapshot);
  const competition = page
    .locator('.competition-selectors label')
    .filter({ hasText: 'Competição' })
    .getByRole('combobox');
  await expect(competition).toBeVisible();
  await selectOption(competition, 'serie-a');
  await expect(competition).toContainText('Série A');
  for (const id of ['premier-league', 'ligue-1', 'bundesliga', 'la-liga', 'serie-a-italia']) {
    await selectOption(competition, id);
    await page.getByRole('button', { name: 'Classificação', exact: true }).click();
    await expect(page.locator('.standings-table tbody tr')).toHaveCount(20);
    await expect(page.locator('.standings-legend')).toContainText('Champions League');
    await expect(page.getByRole('button', { name: 'Jogos do clube', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Partidas', exact: true }).click();
    await expect(page.locator('.calendar-match-card')).toHaveCount(10);
    await selectOption(page.getByRole('combobox', { name: 'Rodada', exact: true }), '0');
    await expect(page.locator('.calendar-match-card[data-finished="true"]')).toHaveCount(10);
    await expect(page.getByRole('button', { name: /assistir|replay/i })).toHaveCount(0);
  }
  await selectOption(competition, 'premier-league');
  await page.getByRole('button', { name: 'Classificação', exact: true }).click();
  await page.screenshot({ path: 'test-results/european-leagues-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.standings-table tbody tr')).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/european-leagues-mobile.png' });
  await page.getByRole('button', { name: 'Partidas', exact: true }).click();
  await expect(page.locator('.calendar-match-card')).toHaveCount(10);
  await selectOption(page.getByRole('combobox', { name: 'Rodada', exact: true }), '0');
  await expect(page.locator('.calendar-match-card[data-finished="true"]')).toHaveCount(10);
  await page.screenshot({ path: 'test-results/european-games-mobile.png' });
});
