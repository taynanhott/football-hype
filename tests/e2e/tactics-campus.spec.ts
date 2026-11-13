import { finishRound } from './round-completion';
import { selectOption } from './select-option';
import { expect, test } from '@playwright/test';

test('edita formação, troca titulares, salva e ganha entrosamento em uma partida', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.locator('.club-choice').first()).toBeVisible();
  if (process.env.E2E_DATASET_FILE)
    await expect(page.locator('.club-choice canvas').first()).toHaveCSS('opacity', '1', {
      timeout: 15000,
    });
  await page.screenshot({ path: 'test-results/club-selector.png' });
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect(page.locator('.tactics-player')).toHaveCount(11);
  await page.getByRole('combobox', { name: 'Formação', exact: true }).click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(15);
  await page.keyboard.press('Escape');
  await selectOption(page.getByRole('combobox', { name: 'Formação', exact: true }), '3-5-2');
  await expect(page.locator('.tactics-player')).toHaveCount(11);
  await page.locator('.tactics-player').first().click();
  await page.locator('.bench-player').filter({ hasText: 'MC' }).first().click();
  await expect(page.locator('.tactics-player.out-of-position').first()).toBeVisible();
  await page.locator('.reserve-section.related summary').click();
  await expect(page.locator('.reserve-section.related .reserve-mini').first()).toBeVisible();
  const reserveCount = await page.locator('.reserve-section.related .reserve-mini').count();
  await page.locator('.reserve-section.related .reserve-mini').first().click();
  await expect(page.getByRole('dialog').locator('.bench-player')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.reserve-section.related .reserve-mini')).toHaveCount(reserveCount);
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Formação', exact: true })).toHaveText('3-5-2');
  await expect(page.locator('.reserve-section.related .reserve-mini')).toHaveCount(reserveCount);
  await expect(page.locator('.sector-chemistry meter')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/tactics-lineup.png', fullPage: true });
  const chemistryBefore = Number(
    (await page.locator('.chemistry-summary-badge').innerText()).replace('%', ''),
  );
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Avançar rodada', exact: true }).click();
  await page.getByRole('button', { name: 'Sim, avançar', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toBeVisible();
  await finishRound(page);
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect
    .poll(async () =>
      Number((await page.locator('.chemistry-summary-badge').innerText()).replace('%', '')),
    )
    .toBeGreaterThan(chemistryBefore);
  expect(errors).toEqual([]);
});

test('consulta bônus do CT e entorno sem alterar os níveis reais', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  for (const name of [
    'Preparação Física',
    'Departamento Médico',
    'Scout',
    'Preparação Técnica',
    'Marketing',
  ]) {
    await page.getByRole('tab', { name, exact: true }).click();
    const level = await page.locator('.facility-card[data-mobile-active=true] .pill').innerText();
    await page.getByRole('button', { name: `Ver bônus de ${name} por nível` }).click();
    await expect(page.getByRole('dialog').locator('.facility-bonus-level')).toHaveCount(5);
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(page.locator('.facility-card[data-mobile-active=true] .pill')).toHaveText(level);
  }
  await page.getByRole('link', { name: 'Estádio', exact: true }).click();
  await page.getByRole('tab', { name: 'Entorno da arena', exact: true }).click();
  await page.getByRole('button', { name: 'Ver bônus de Entorno da arena por nível' }).click();
  await expect(page.getByRole('dialog').locator('.facility-bonus-level')).toHaveCount(5);
  await page.screenshot({ path: 'test-results/surroundings-level-5.png' });
});
