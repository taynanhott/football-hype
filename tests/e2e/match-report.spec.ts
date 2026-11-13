import { finishRound } from './round-completion';
import { selectOption } from './select-option';
import { expect, test } from '@playwright/test';
test('salva identidade, mostra partida 3D e preserva relatório e notas', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await page.getByRole('tab', { name: 'Marketing', exact: true }).click();
  await page
    .locator('.sector-marketing')
    .getByRole('button', { name: 'Gerenciar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Personalizar clube' }).click();
  await page.getByLabel('Cor do estádio personalizada', { exact: true }).fill('#d74265');
  await page.getByLabel('Cor do CT personalizada', { exact: true }).fill('#526fb3');
  await selectOption(page.getByRole('combobox', { name: 'Padrão', exact: true }), 'stripes');
  await page.getByRole('button', { name: 'Salvar identidade' }).click();
  await expect(page.getByRole('button', { name: 'Salvar identidade' })).toBeEnabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('link', { name: 'Carreira', exact: true }).click();
  await expect(page.locator('.club-profile-identity')).toBeVisible({ timeout: 20000 });
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await page.getByRole('tab', { name: 'Marketing', exact: true }).click();
  await page
    .locator('.sector-marketing')
    .getByRole('button', { name: 'Gerenciar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Personalizar clube' }).click();
  await expect(page.getByLabel('Cor do estádio personalizada', { exact: true })).toHaveValue(
    '#d74265',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Avançar rodada', exact: true }).click();
  await page.getByRole('button', { name: 'Sim, avançar', exact: true }).click();
  await expect(page).toHaveURL(/#\/matches$/, { timeout: 30000 });
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.match-ratings-persistent .player-rating-chip')).toHaveCount(22);
  await page.getByRole('tab', { name: 'Estatísticas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Estatísticas ao vivo', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/match-live.png', timeout: 30000 });
  await finishRound(page);
  await expect(
    page.getByRole('heading', { name: 'Estatísticas finais', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Chutes no alvo', { exact: true })).toBeVisible();
  await expect(page.locator('.match-ratings-persistent')).toBeVisible();
  const saved = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const result = useGameStore.getState().snapshot.state.results[0];
    return {
      id: result.fixtureId,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      ratings: result.ratings,
      tacticalPlans: result.tacticalPlans,
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.match-ratings-persistent')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Notas', exact: true }).click();
  await expect(page.locator('.ratings-half')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/match-ratings.png' });
  await page.getByRole('tab', { name: 'Notas', exact: true }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Lance a lance', exact: true })).toBeFocused();
  await expect(page.locator('.goals-cards')).toBeVisible();
  await page.getByRole('tab', { name: 'Partidas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Placar da rodada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rever partida', exact: true }).click();
  await expect(page.locator('.broadcast-clock > span')).toHaveText('1T');
  await page.clock.install();
  await page.clock.fastForward(91000);
  await page.getByRole('button', { name: 'Voltar à página inicial' }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await page.reload();
  await page.locator('.career-save-open').first().click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  expect(
    await page.evaluate(async (id) => {
      const path = '/src/store/game-store.ts';
      const { useGameStore } = await import(path);
      const result = useGameStore
        .getState()
        .snapshot.state.results.find((r: { fixtureId: string }) => r.fixtureId === id);
      return {
        id: result.fixtureId,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        ratings: result.ratings,
        tacticalPlans: result.tacticalPlans,
      };
    }, saved.id),
  ).toEqual(saved);
  expect(errors).toEqual([]);
});
