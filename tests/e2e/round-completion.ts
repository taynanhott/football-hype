import { expect, type Page } from '@playwright/test';

/** The server confirms first; the client keeps navigation locked for the 90s broadcast. */
export async function finishRound(page: Page, round = 1) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const path = '/src/store/game-store.ts';
          const { useGameStore } = await import(path);
          return useGameStore.getState().snapshot.state.round;
        }),
      { timeout: 120000 },
    )
    .toBe(round);
  await expect(page.getByRole('link', { name: 'Visão geral', exact: true })).toBeEnabled({
    timeout: 120000,
  });
}
