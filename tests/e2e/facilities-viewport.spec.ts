import { expect, test } from '@playwright/test';

test('CT e estádio cabem na tela com painéis de altura estável', async ({ page }) => {
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
  for (const route of ['training', 'stadium']) {
    await page.evaluate((route) => {
      location.hash = '/' + route;
      window.scrollTo(0, 0);
    }, route);
    const tabs = page.locator('.facility-two-row-tabs [role=tab]');
    await expect(tabs).toHaveCount(route === 'training' ? 5 : 6);
    for (const size of [
      { width: 390, height: 844 },
      { width: 360, height: 640 },
    ]) {
      await page.setViewportSize(size);
      const gaps = await tabs.evaluateAll((buttons) => {
        const boxes = buttons.map((button) => button.getBoundingClientRect());
        const rows = [...new Set(boxes.map((box) => box.top))].sort((a, b) => a - b);
        const distances: number[] = [];
        for (const top of rows) {
          const row = boxes.filter((box) => box.top === top).sort((a, b) => a.left - b.left);
          row.slice(1).forEach((box, i) => distances.push(box.left - row[i]!.right));
        }
        if (rows.length > 1)
          distances.push(
            rows[1]! -
              Math.max(...boxes.filter((box) => box.top === rows[0]).map((box) => box.bottom)),
          );
        return {
          rows: rows.length,
          min: Math.min(...distances),
          heights: boxes.map((box) => box.height),
        };
      });
      expect(gaps.rows).toBe(2);
      expect(gaps.min).toBeGreaterThanOrEqual(7);
      expect(gaps.heights.every((height) => height === 34)).toBe(true);
      let firstHeight = 0;
      for (let i = 0; i < (await tabs.count()); i++) {
        await tabs.nth(i).click();
        const active = page.locator('.facility-card[data-mobile-active=true]');
        await expect(active).toBeVisible();
        const dimensions = await active.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const nav = document.querySelector('.mobile-bottom-nav')!.getBoundingClientRect();
          return {
            height: rect.height,
            bottom: rect.bottom,
            nav: nav.top,
            fits: element.scrollHeight <= element.clientHeight + 1,
          };
        });
        firstHeight ||= dimensions.height;
        expect(dimensions.height).toBeCloseTo(firstHeight, 0);
        expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.nav);
        expect(dimensions.fits).toBe(true);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      }
      await page.screenshot({ path: `test-results/${route}-compact-${size.height}.png` });
    }
  }
});
