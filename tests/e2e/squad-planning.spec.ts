import { expect, test } from '@playwright/test';

test('auxiliar anota renovação e políticas localmente e confirma com um único envio', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.save-queue-status')).toHaveText('✓ Carreira sincronizada', {
    timeout: 20000,
  });
  await page.goto('/#/squad');
  await expect(page.locator('.squad-notebook')).toBeVisible();
  const before = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    return useGameStore.getState().snapshot.state.revision;
  });
  for (const index of [0, 1]) {
    const row = page.locator('.squad-office-player').nth(index);
    await row.getByRole('button', { name: 'Negociação', exact: true }).click();
    await row.getByRole('switch', { name: 'Disponível para negociação' }).check();
  }
  let renewalAdded = false;
  for (let index = 0; index < 10; index++) {
    const row = page.locator('.squad-office-player').nth(index);
    await row.getByRole('button', { name: 'Renegociação', exact: true }).click();
    const renew = row.getByRole('button', { name: /^Anotar renovação/ });
    if ((await renew.count()) && (await renew.isEnabled())) {
      const range = row.locator('input.money-range');
      const currentSalary = Number(await range.inputValue());
      expect(Number(await range.getAttribute('max'))).toBe(currentSalary * 2);
      expect(Number(await range.getAttribute('min'))).toBe(
        Math.ceil((currentSalary * 0.5) / 500) * 500,
      );
      await range.fill(String(currentSalary * 2));
      const fit = await row.evaluate((element) => {
        const controls = element.querySelector('.squad-office-actions')!;
        const button = element.querySelector('.negotiate-button')!;
        return {
          overflow: getComputedStyle(controls).overflowY,
          buttonBottom: button.getBoundingClientRect().bottom,
          rowBottom: element.getBoundingClientRect().bottom,
        };
      });
      expect(fit.overflow).toBe('visible');
      expect(fit.buttonBottom).toBeLessThan(fit.rowBottom - 8);
      await page.screenshot({
        path: 'test-results/squad-renewal-desktop.png',
        animations: 'disabled',
      });
      await renew.click();
      if (!(await page.locator('.notebook-summary').textContent())?.includes('3 ações anotadas'))
        continue;
      renewalAdded = true;
      break;
    }
  }
  expect(renewalAdded).toBe(true);
  await expect(page.locator('.notebook-summary')).toContainText('3 ações anotadas');
  const staged = await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    return {
      revision: useGameStore.getState().snapshot.state.revision,
      pending: useGameStore.getState().pendingActions,
    };
  });
  expect(staged).toEqual({ revision: before, pending: 0 });
  // Count at the existing room boundary (the socket was established before this test step).
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const room = useGameStore.getState().room,
      send = room.send.bind(room);
    (window as unknown as { plannedSends: number }).plannedSends = 0;
    room.send = (type: string, data: unknown) => {
      if (type === 'command') (window as unknown as { plannedSends: number }).plannedSends++;
      return send(type, data);
    };
  });
  await page.getByRole('button', { name: 'Pode colocar em prática', exact: true }).click();
  await expect(page.locator('.assistant-speech')).toContainText('Tudo certo', { timeout: 20000 });
  expect(
    await page.evaluate(() => (window as unknown as { plannedSends: number }).plannedSends),
  ).toBe(1);
  const row = page.locator('.squad-office-player').first();
  await row.getByRole('button', { name: 'Negociação', exact: true }).click();
  await row.getByRole('switch', { name: 'Disponível para negociação' }).uncheck();
  await expect(page.locator('.notebook-summary')).toContainText('1 ação anotada');
  await page.goto('/#/finances');
  await page.goto('/#/squad');
  await expect(page.locator('.notebook-summary')).toContainText('Prancheta aberta');
  await expect(page.getByRole('button', { name: 'Limpar anotações' })).toHaveCount(0);
  await expect(page.locator('.squad-office .squad-averages')).toHaveCount(0);
  await page.locator('.squad-office-player').first().locator('.player-card').click();
  await expect(
    page.locator('.squad-office-player').first().locator('.card-back .eyebrow'),
  ).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/squad-office-desktop.png',
    fullPage: false,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.squad-notebook')).toBeVisible();
  const mobileRow = page.locator('.squad-office-player').first();
  await expect(mobileRow.locator('.squad-mobile-action-buttons button')).toHaveCount(3);
  await expect(mobileRow.locator('.management-tabs')).toHaveCount(0);
  await expect(mobileRow.getByText('Toque na carta para ver o verso')).toHaveCount(0);
  await expect(mobileRow.getByRole('link', { name: /Propostas recebidas/ })).toHaveCount(0);
  const sideBySide = await mobileRow.evaluate((element) => {
    const card = element.querySelector('.player-card')!.getBoundingClientRect();
    const actions = element.querySelector('.squad-mobile-action-buttons')!.getBoundingClientRect();
    return actions.left >= card.right && actions.top < card.bottom;
  });
  expect(sideBySide).toBe(true);
  await mobileRow.getByRole('button', { name: 'Negociação', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Negociação ·/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Propostas recebidas/ })).toBeVisible();
  await dialog.getByRole('switch', { name: 'Disponível para negociação' }).uncheck();
  await expect(page.locator('.notebook-summary')).toContainText('1 ação anotada');
  expect(
    await page.evaluate(() => (window as unknown as { plannedSends: number }).plannedSends),
  ).toBe(1);
  await page.screenshot({ path: 'test-results/squad-action-mobile.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Voltar ao elenco' }).click();
  await expect(dialog).toHaveCount(0);
  await mobileRow.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'test-results/squad-office-mobile.png',
    fullPage: false,
    animations: 'disabled',
  });
});
