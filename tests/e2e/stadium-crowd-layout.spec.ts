import { expect, test } from '@playwright/test';

test('renderiza a torcida nos estádios reais', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const store = useGameStore.getState();
    const { snapshot } = store,
      { state } = snapshot;
    const ownId = state.participants.find(
      (p: { userId: string }) => p.userId === store.userId,
    ).clubId;
    const fixture = state.fixtures.find(
      (f: { homeId: string; awayId: string }) => f.homeId === ownId || f.awayId === ownId,
    );
    const stadiumId = state.clubs.byId[fixture.homeId].stadiumId;
    const stadium = state.stadiums.byId[stadiumId];
    const result = {
      fixtureId: fixture.id,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      stadiumId,
      status: 'finished',
      homeGoals: 0,
      awayGoals: 0,
      startedAt: Date.now() + store.clockOffset - 100000,
      attendance: 100000,
      revenue: 1000000,
      seed: 1,
      scorers: [],
      ratings: {},
      lineups: {
        home: state.clubs.byId[fixture.homeId].playerIds.slice(0, 11),
        away: state.clubs.byId[fixture.awayId].playerIds.slice(0, 11),
      },
    };
    useGameStore.setState({
      snapshot: {
        ...snapshot,
        state: {
          ...state,
          results: [result],
          stadiums: {
            ...state.stadiums,
            byId: {
              ...state.stadiums.byId,
              [stadiumId]: {
                ...stadium,
                skin: 'neo-quimica',
                sectors: stadium.sectors.map((s: { level: number }) => ({ ...s, level: 4 })),
              },
            },
          },
        },
      },
    });
    location.hash = '/matches';
  });
  await expect(page.locator('.match-scene .scene-root')).toHaveAttribute(
    'data-scene-ready',
    'true',
    { timeout: 60000 },
  );
  await page.addStyleTag({ content: '.match-end-overlay{display:none!important}' });
  for (const skin of [
    'palmeiras-park',
    'morumbi',
    'vila-belmiro',
    'arena-baixada',
    'maracana',
    'mineirao',
    'arena-mrv',
    'neo-quimica',
    'sao-januario',
    'beira-rio',
    'arena-gremio',
    'nilton-santos',
  ]) {
    await page.evaluate(async (skin) => {
      const path = '/src/store/game-store.ts';
      const { useGameStore } = await import(path);
      const { snapshot } = useGameStore.getState(),
        { state } = snapshot;
      const stadiumId = state.results[0].stadiumId;
      useGameStore.setState({
        snapshot: {
          ...snapshot,
          state: {
            ...state,
            stadiums: {
              ...state.stadiums,
              byId: {
                ...state.stadiums.byId,
                [stadiumId]: { ...state.stadiums.byId[stadiumId], skin },
              },
            },
          },
        },
      });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }, skin);
    await page.locator('.match-scene').screenshot({ path: `test-results/crowd-${skin}.png` });
  }
  expect(errors).toEqual([]);
});
