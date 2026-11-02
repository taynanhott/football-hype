import { expect, test } from '@playwright/test';

test('salvar escalação fica no topo e só menus de instruções recebem o tema', async ({ page }) => {
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const save = page.getByRole('button', { name: '+ Salvar atual', exact: true });
    await expect(save).toBeInViewport();
    const saved = await page.locator('.lineup-editor > .lineup-presets').boundingBox();
    const pitch = await page.locator('.tactics-panel').boundingBox();
    expect(saved!.y + saved!.height).toBeLessThanOrEqual(pitch!.y);
    const menu = page.getByRole('region', { name: 'Durante o jogo' });
    const filterBackground = await page.evaluate(() => {
      const container = document.createElement('div');
      container.className = 'squad-office';
      const filter = document.createElement('div');
      filter.className = 'squad-office-controls';
      container.append(filter);
      document.body.append(container);
      const background = getComputedStyle(filter).backgroundImage;
      container.remove();
      return background;
    });
    expect(await menu.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(filterBackground);
    expect(
      await page.locator('.tactics-clipboard').evaluate((e) => getComputedStyle(e).backgroundImage),
    ).toBe(filterBackground);
    const formation = page.getByRole('combobox', { name: 'Formação', exact: true });
    await expect(formation.locator('.formation-option-icon')).toHaveCount(1);
    await formation.click();
    const formations = page.getByRole('listbox').filter({ visible: true });
    await expect(formations.locator('.formation-option-icon')).toHaveCount(15);
    await formations.getByRole('option', { name: '4-3-3', exact: true }).click();
    expect(await menu.locator('h3').evaluate((e) => getComputedStyle(e).color)).toBe(
      'rgb(240, 213, 139)',
    );
    expect(
      await page.locator('.tactics-panel').evaluate((e) => getComputedStyle(e).backgroundImage),
    ).not.toContain('data:image/svg+xml');
    if (width < 760) {
      expect((await page.locator('.tactics-clipboard').boundingBox())!.height).toBeLessThan(380);
      expect(
        await page
          .locator('.play-style-grid')
          .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length),
      ).toBe(3);
      expect(
        (await page.getByRole('button', { name: 'Análise tática', exact: true }).boundingBox())!
          .height,
      ).toBeLessThanOrEqual(36);
    }
    for (const kind of ['Estilo', 'Formação']) {
      const control = page.getByRole('combobox', { name: new RegExp(`^${kind}:`) }).first();
      await control.click();
      const list = page.getByRole('listbox').filter({ visible: true });
      const bounds = await list.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(239);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 11);
      await expect(list.getByRole('option')).toHaveCount(kind === 'Estilo' ? 7 : 16);
      for (const option of await list.locator('.match-option-content').all()) {
        await expect(option.locator('svg')).toHaveCount(1);
        const text = option.locator(':scope > span');
        expect(await text.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
        expect(await text.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
      }
      await page.screenshot({ path: `.test-temp/match-${kind}-${width}.png` });
      await list
        .getByRole('option', {
          name: kind === 'Estilo' ? 'Avanço pelas pontas' : '4-3-3',
          exact: true,
        })
        .click();
      await expect(control.locator('.match-option-content svg')).toHaveCount(1);
    }
    await menu.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.test-temp/match-menu-themed-${width}.png` });
  }
  await page.getByRole('button', { name: '+ Planejar', exact: true }).click();
  const modal = page.locator('.match-plan-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.bench-player:not(:disabled)').first().locator('b svg')).toHaveCount(
    1,
  );
  await modal.locator('.bench-player:not(:disabled)').first().click();
  await modal.locator('.bench-player:not(:disabled)').first().click();
  await expect(modal.locator('.match-plan-options')).toBeVisible();
  await page.screenshot({ path: '.test-temp/match-menu-options-themed.png' });
  await modal.getByRole('button', { name: 'Aos 90′', exact: true }).click();
  await modal.getByRole('button', { name: 'Sempre', exact: true }).click();
  const swap = page.locator('.planned-swap');
  await expect(swap).toHaveCount(1);
  await expect(swap.locator('.planned-player-out')).toContainText('Sai');
  await expect(swap.locator('.planned-player-in')).toContainText('Entra');
  await expect(swap.getByRole('button', { name: 'Remover troca 1' })).toContainText('Excluir');
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await swap.scrollIntoViewIfNeeded();
    expect(await swap.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    expect((await swap.getByRole('button').boundingBox())!.height).toBeGreaterThanOrEqual(36);
    await page.screenshot({ path: `.test-temp/planned-swap-refined-${width}.png` });
  }
  await swap.getByRole('button', { name: 'Remover troca 1' }).click();
  await expect(swap).toHaveCount(0);
});
