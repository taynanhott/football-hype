import { finishRound } from './round-completion';
import { expect, test } from '@playwright/test';

test('carreira completa: elenco, carta, estádio, CT, rodada e retorno', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'Elenco', exact: true }).click();
  await page.locator('.squad-planning-list-row').first().click();
  const card = page.locator('.squad-modal-player-card .player-card').first();
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByText('Potencial', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Estádio', exact: true }).click();
  await page.getByRole('tab', { name: 'Estrutura do Estádio', exact: true }).click();
  const north = page
    .locator('.facility-card')
    .filter({ has: page.getByRole('heading', { name: 'Estrutura do Estádio', exact: true }) });
  await north.getByRole('button', { name: /Upgrade/ }).click();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await expect(north.getByText('NÍVEL 4 / 5')).toBeVisible();
  await page.getByRole('link', { name: 'Centro de treinamento', exact: true }).click();
  const fitness = page
    .locator('.facility-card')
    .filter({ has: page.getByRole('heading', { name: 'Preparação Física', exact: true }) });
  await fitness.getByRole('button', { name: /Upgrade/ }).click();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await expect(fitness.getByText('NÍVEL 5 / 5')).toBeVisible();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Avançar rodada', exact: true }).click();
  await page.getByRole('button', { name: 'Sim, avançar', exact: true }).click();
  await finishRound(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', timeout: 30000 });
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await page.getByRole('button', { name: /Abrir livro/ }).click();
  await expect(page.getByRole('heading', { name: 'Livro de movimentações' })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Rodada global 1 concluída', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Trocar de carreira' }).click();
  await expect(page.getByRole('button', { name: /Nova carreira solo/ })).toBeVisible();
  await page.locator('.career-save-open').first().click();
  await expect(page.locator('.save-queue-status')).toBeVisible();
  expect(errors).toEqual([]);
});

test('liga multiplayer sincroniza preparo e rodada para dois treinadores', async ({ browser }) => {
  test.setTimeout(180000);
  const first = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const second = await browser.newContext();
  const host = await first.newPage();
  const guest = await second.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: /Nova liga multiplayer/ }).click();
  await host.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(host.locator('.save-queue-status')).toBeVisible({
    timeout: 20000,
  });
  const id = await host.evaluate(() => localStorage.getItem('football.lastLeague'));
  if (!id) throw new Error('Liga não criada');
  await guest.goto('/');
  await guest.getByRole('button', { name: /Entrar com convite/ }).click();
  await host.getByRole('link', { name: 'Gerenciamento', exact: true }).click();
  await host.getByRole('button', { name: 'Gerar convite', exact: true }).click();
  await host.getByRole('button', { name: 'Copiar convite' }).click();
  const invite = await host.getByLabel('Código do convite', { exact: true }).inputValue();
  await guest.getByLabel('Código da liga').fill(invite);
  await guest.getByRole('button', { name: 'Validar convite' }).click();
  await expect(guest.getByRole('button', { name: 'Entrar na liga', exact: true })).toBeEnabled();
  await guest.getByRole('button', { name: 'Entrar na liga', exact: true }).click();

  await expect(guest.locator('.save-queue-status')).toBeVisible({ timeout: 20000 });
  await expect(guest.getByText('2 treinadores na liga')).toBeVisible();
  await expect(host.getByText('2 treinadores na liga')).toBeVisible();
  await guest.getByRole('link', { name: 'Gerenciamento', exact: true }).click();
  await expect(guest.getByRole('button', { name: 'Rodadas', exact: true })).toHaveCount(0);
  await expect(guest.getByRole('button', { name: 'Gerar convite', exact: true })).toBeEnabled();
  await expect(guest.getByRole('button', { name: 'Abandonar liga online' })).toBeVisible();
  await guest.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await host.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await host.getByRole('button', { name: 'Marcar pronto' }).click();
  await expect(guest.getByText(/1 de 2 treinadores prontos/)).toBeVisible();
  await guest.getByRole('button', { name: 'Marcar pronto' }).click();
  await finishRound(host);
  await finishRound(guest);
  await first.close();
  await second.close();
});

test('carreira funciona em tela de celular sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada', {
    timeout: 20000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
});
