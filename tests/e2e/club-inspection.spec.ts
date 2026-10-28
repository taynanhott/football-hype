import { selectOption } from './select-option';
import { test, expect } from '@playwright/test';
test('retratos variados, cartas no mercado e consulta das estruturas de outro clube', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar minha história' }).click();
  await expect(page.getByRole('heading', { name: 'O próximo capítulo começa aqui.' })).toBeVisible({
    timeout: 20000,
  });
  const ownClub = await page.locator('.sidebar-club strong').textContent();
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await expect(page.locator('.player-card').first()).toBeVisible();
  const tones = await page
    .locator('.pixel-portrait')
    .evaluateAll((nodes) => [
      ...new Set(
        nodes
          .flatMap((n) => [...n.querySelectorAll('path')].map((p) => p.getAttribute('fill')))
          .filter((c) =>
            [
              '#f1d0b0',
              '#e6b890',
              '#cd986e',
              '#b67d50',
              '#b67d55',
              '#936244',
              '#70482f',
              '#513626',
              '#533422',
              '#b27b50',
              '#d5a17a',
              '#ecc4a3',
            ].includes(c ?? ''),
          ),
      ),
    ]);
  expect(tones.length).toBeGreaterThan(1);
  await page.screenshot({ path: 'test-results/varied-player-cards.png' });
  await page.getByRole('link', { name: 'Transferências', exact: true }).click();
  const card = page.locator('.player-card').first();
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.card-back')).toContainText('★');
  await page.screenshot({ path: 'test-results/market-player-details.png' });
  await page.getByRole('link', { name: 'Troféus e clubes', exact: true }).click();
  const selector = page.getByLabel('Consultar clube');
  await selectOption(selector, { index: 1 });
  const name = await selector.locator('option:checked').textContent();
  await expect(page.getByRole('heading', { name: 'Elenco do ' + name, exact: true })).toBeVisible();
  await expect(page.locator('.player-card').first()).toBeVisible();
  const tabs = page.getByRole('group', { name: 'Dados do clube' });
  await tabs.getByRole('button', { name: 'Estádio', exact: true }).click();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Capacidade', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Melhorar/ })).toHaveCount(0);
  await page
    .locator('.club-inspection')
    .screenshot({ path: 'test-results/other-club-stadium.png' });
  await tabs.getByRole('button', { name: 'CT', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Centro de treinamento de ' + name, exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Departamento médico', { exact: true })).toBeVisible();
  await page
    .locator('.club-inspection')
    .screenshot({ path: 'test-results/other-club-training.png' });
  await expect(page.locator('.sidebar-club strong')).toHaveText(ownClub!);
  await page.getByRole('link', { name: 'Competições', exact: true }).click();
  await page.locator('.club-cell').nth(1).click();
  await expect(page.getByRole('heading', { name: /Elenco do / })).toBeVisible();
  expect(errors).toEqual([]);
});
