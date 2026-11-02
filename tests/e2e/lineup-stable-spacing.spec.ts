import { expect, test } from '@playwright/test';

test('escalação mantém o tamanho ao rolar e separa cartas e modificadores em todos os esquemas', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '/lineup';
  });
  const pitch = page.locator('.tactics-field');
  await expect(pitch).toBeVisible();
  const height = (await pitch.boundingBox())!.height;
  for (const width of [1280, 360, 390]) {
    await page.setViewportSize({ width, height: 640 });
    for (const formation of [
      '4-4-2',
      '4-3-3',
      '4-2-3-1',
      '4-1-4-1',
      '4-4-1-1',
      '4-3-1-2 losango',
      '4-2-2-2 quadrado',
      '4-3-3 ofensivo',
      '4-2-4',
      '4-5-1',
      '3-5-2',
      '3-4-3',
      '3-2-4-1 moderno',
      '5-3-2',
      '5-4-1',
    ]) {
      await page.getByRole('combobox', { name: 'Formação', exact: true }).click();
      await page.getByRole('option', { name: formation, exact: true }).click();
      const overlaps = await page.locator('.tactics-player').evaluateAll((cards) => {
        const boxes = cards.map((card) => {
          let badge = card.querySelector('.overall-modifier');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'overall-modifier positive';
            card.querySelector('.overall-value')!.append(badge);
          }
          badge.textContent = '+12';
          const a = card.getBoundingClientRect(),
            b = badge.getBoundingClientRect();
          return {
            left: Math.min(a.left, b.left),
            right: Math.max(a.right, b.right),
            top: Math.min(a.top, b.top),
            bottom: a.bottom,
          };
        });
        return boxes.flatMap((a, i) =>
          boxes
            .slice(i + 1)
            .flatMap((b, j) =>
              a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
                ? [[i, i + j + 1]]
                : [],
            ),
        );
      });
      expect(overlaps, `${formation} em ${width}px`).toEqual([]);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await pitch.boundingBox())!.height).toBe(width > 760 ? 620 : height);
    await page.mouse.wheel(0, 500);
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.visualViewport?.dispatchEvent(new Event('resize')));
    expect((await pitch.boundingBox())!.height).toBe(width > 760 ? 620 : height);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/lineup-stable-${width}.png` });
  }
});
