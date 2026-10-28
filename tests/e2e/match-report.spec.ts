import { selectOption } from './select-option';
import { expect, test } from '@playwright/test';
test('salva identidade, mostra partida 3D e preserva relatório e notas', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await page.getByRole('button', { name: 'Personalizar clube' }).click();
  await page.getByLabel('Cor do estádio').fill('#d74265');
  await page.getByLabel('Cor do CT').fill('#526fb3');
  await selectOption(page.getByLabel('Padrão', { exact: true }), 'stripes');
  await page.getByRole('button', { name: 'Salvar identidade' }).click();
  await expect(page.getByRole('button', { name: 'Salvar identidade' })).toBeEnabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('link', { name: 'Troféus e clubes' }).click();
  await expect(page.getByRole('heading', { name: 'Galeria de troféus' })).toBeVisible();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await page.getByRole('button', { name: 'Personalizar clube' }).click();
  await expect(page.getByLabel('Cor do estádio')).toHaveValue('#d74265');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Avançar rodada', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Gerenciamento', exact: true }).click();
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.getByLabel('Padrão', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rodadas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Avançar rodada', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Avançar rodada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Central de partidas' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.match-ratings-persistent .player-rating-chip')).toHaveCount(22);
  await expect(page.locator('.match-ratings-persistent')).toContainText('Ao vivo');
  const ratingsBounds = await page.locator('.match-ratings-body').evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      scroll: el.scrollHeight,
      client: el.clientHeight,
      allVisible: Array.from(el.querySelectorAll('.rated-player')).every((player) => {
        const r = player.getBoundingClientRect();
        return r.top >= box.top && r.bottom <= box.bottom;
      }),
    };
  });
  expect(ratingsBounds.scroll).toBeLessThanOrEqual(ratingsBounds.client + 1);
  expect(ratingsBounds.allVisible).toBe(true);
  await page.screenshot({ path: 'test-results/match-live.png', fullPage: true });
  await page.clock.install();
  await page.clock.fastForward(46000);
  await expect(page.getByRole('heading', { name: 'Estatísticas finais' })).not.toBeVisible();
  await expect(page.locator('.broadcast-live')).toBeVisible();
  await page.locator('.round-result-card').first().click();
  await expect(page.locator('.broadcast-live')).toHaveText('AO VIVO');
  expect(
    Number((await page.locator('.broadcast-clock time').innerText()).split(':')[0]),
  ).toBeGreaterThanOrEqual(40);
  await page.clock.runFor(300);
  await page.screenshot({ path: 'test-results/match-build-up.png', fullPage: true });
  await page.clock.fastForward(45000);
  await expect(page.getByRole('button', { name: 'Avançar rodada', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Estatísticas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estatísticas finais' })).toBeVisible();
  await expect(page.getByText('Chutes no alvo', { exact: true })).toBeVisible();
  await expect(page.locator('.match-ratings-persistent')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Notas dos jogadores' })).toHaveCount(0);
  const sizes = await page
    .locator('.match-reports-layout > *')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height));
  expect(Math.abs(sizes[0]! - sizes[1]!)).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/match-statistics.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.match-ratings-persistent')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Notas dos jogadores' }).click();
  await expect(page.getByRole('heading', { name: 'Notas dos atletas' })).toBeVisible();
  await expect(page.locator('.ratings-half')).toHaveCount(2);
  expect(
    await page.getByRole('tabpanel').evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/match-ratings.png', fullPage: true });
  await page.getByRole('tab', { name: 'Notas dos jogadores' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Gols e cartões' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Gols e cartões' })).toBeVisible();
  await expect(page.locator('.goals-cards')).toHaveCSS('background-color', 'rgb(34, 38, 43)');
  await expect(page.getByRole('button', { name: /Rever/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/match-events.png', fullPage: true });
  await page.getByRole('tab', { name: 'Partidas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Placar da rodada' })).toBeVisible();
  await page.locator('.round-result-card').first().click();
  await expect(page.locator('.broadcast-live')).toHaveText('REPRISE');
  await expect(page.locator('.broadcast-clock time')).toHaveText('00:00');
  await expect(page.locator('.round-result-status strong').first()).toHaveText('FIM');
  await page.clock.fastForward(91000);
  await page.getByRole('button', { name: 'Voltar à página inicial' }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  expect(errors).toEqual([]);
});
