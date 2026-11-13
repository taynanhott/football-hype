import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const styles = readFileSync('apps/client/src/ui/styles.css', 'utf8');

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`fundo fixo e modal rolável sem filtros no mobile ${viewport.width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.setContent(`
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${styles}</style>
      <div class="app-shell"><div class="workspace">
        <main class="main-content"><section class="transfer-hub" style="height:3000px"></section></main>
      </div></div>
      <dialog class="player-detail-modal"><div style="height:2000px">Atletas</div></dialog>
    `);
    const background = () =>
      page.locator('.workspace').evaluate((element) => {
        const style = getComputedStyle(element, '::before');
        return { position: style.position, top: style.top, image: style.backgroundImage };
      });
    const before = await background();
    expect(before.position).toBe('fixed');
    await page.evaluate(() => window.scrollTo(0, 500));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(await background()).toEqual(before);
    expect(
      await page.locator('.workspace').evaluate((e) => getComputedStyle(e).backgroundImage),
    ).not.toContain('feTurbulence');
    await page.locator('dialog').evaluate((element: HTMLDialogElement) => {
      element.style.cssText = 'height:200px; overflow:auto';
      element.showModal();
    });
    expect(
      await page
        .locator('dialog')
        .evaluate((element) => getComputedStyle(element, '::backdrop').backdropFilter),
    ).toBe('none');
    await page.locator('dialog').evaluate((element) => element.scrollTo(0, 300));
    expect(await page.locator('dialog').evaluate((element) => element.scrollTop)).toBeGreaterThan(
      0,
    );
    await context.close();
  });
}

test('preserva textura e desfoque dos menus no desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(
    `<style>${styles}</style><div class="workspace"></div><dialog class="player-detail-modal"></dialog>`,
  );
  await expect(page.locator('.workspace')).toHaveCSS(
    'background-attachment',
    /^(fixed)(, fixed)*$/,
  );
  expect(
    await page.locator('.workspace').evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain('feTurbulence');
  expect(
    await page.locator('dialog').evaluate((e) => getComputedStyle(e, '::backdrop').backdropFilter),
  ).toBe('blur(5px)');
});
