import { selectOption } from './select-option';
import { expect, test } from '@playwright/test';

test('edita formação, troca titulares, salva e ganha entrosamento em uma partida', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.locator('.club-choice').first()).toBeVisible();
  if (process.env.E2E_DATASET_FILE)
    await expect(page.locator('.club-choice canvas').first()).toHaveCSS('opacity', '1', {
      timeout: 15000,
    });
  await page.screenshot({ path: 'test-results/club-selector.png' });
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Escalação e tática' })).toBeVisible();
  await page.getByLabel('Formação').click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(11);
  await page.keyboard.press('Escape');
  await selectOption(page.getByLabel('Formação'), '3-5-2');
  await expect(page.locator('.tactics-player')).toHaveCount(11);
  await page.locator('.tactics-player').first().click();
  await page.locator('.bench-player').filter({ hasText: 'CM' }).first().click();
  await expect(page.locator('.tactics-player.out-of-position').first()).toBeVisible();
  await expect(page.locator('.reserve-section.related .reserve-mini').first()).toBeVisible();
  const reserveCount = await page.locator('.reserve-section.related .reserve-mini').count();
  await page.locator('.reserve-section.related .reserve-mini').first().click();
  await page.locator('.reserve-swap-modal .bench-player:not(:disabled)').first().click();
  await expect(page.locator('.reserve-section.related .reserve-mini')).toHaveCount(reserveCount);
  await expect(page.getByRole('status')).toContainText('Escalação atualizada automaticamente');
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect(page.getByLabel('Formação')).toHaveText('3-5-2');
  await expect(page.locator('.reserve-section.related .reserve-mini')).toHaveCount(reserveCount);
  await expect(page.locator('.sector-chemistry meter')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/tactics-lineup.png', fullPage: true });
  await page.getByRole('button', { name: 'Avançar rodada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Central de partidas' })).toBeVisible();
  await page.getByRole('link', { name: 'Escalação', exact: true }).click();
  await expect(
    page.locator('.tactics-chemistry').filter({ hasText: '20% ENT.' }).first(),
  ).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

test('CT e entorno têm prévias próprias sem alterar os níveis reais', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.locator('.facility-scene').screenshot({ path: 'test-results/campus-level-1.png' });
  for (const name of [
    'Preparação Física',
    'Departamento Médico',
    'Scout',
    'Preparação Técnica',
    'Marketing',
  ])
    await selectOption(page.getByLabel(`Prévia de ${name}`, { exact: true }), '5');
  await page.waitForTimeout(1000);
  await page.locator('.facility-scene').screenshot({ path: 'test-results/campus-level-5.png' });
  await expect(page.getByText('NÍVEL 3 / 5')).toHaveCount(3);
  await expect(page.getByText('NÍVEL 4 / 5')).toHaveCount(2);
  await page.getByRole('link', { name: 'Estádio', exact: true }).click();
  await selectOption(page.getByLabel('Prévia do entorno'), '5');
  await page.waitForTimeout(700);
  await page
    .locator('.facility-scene')
    .screenshot({ path: 'test-results/surroundings-level-5.png' });
});
