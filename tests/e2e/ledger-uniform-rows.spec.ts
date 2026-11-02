import { expect, test } from '@playwright/test';

test('livro usa todas as linhas com altura uniforme e completa a última folha em branco', async ({
  page,
}) => {
  await page.route('**/src/three/stadium-scene.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function StadiumScene(){return null}',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Nova carreira solo/ }).click();
  await page.getByRole('button', { name: 'Iniciar carreira', exact: true }).click();
  await expect(page.locator('.club-calendar')).toBeVisible();
  await expect(page.locator('.save-queue-status')).toContainText('sincronizada');
  await page.evaluate(async () => {
    const path = '/src/store/game-store.ts';
    const { useGameStore } = await import(path);
    const { snapshot, userId } = useGameStore.getState();
    useGameStore.getState().disconnect();
    const clubId = snapshot.state.participants[0].clubId;
    useGameStore.setState({
      userId,
      connected: true,
      snapshot: {
        ...snapshot,
        ledger: Array.from({ length: 45 }, (_, i) => ({
          ...snapshot.ledger[0],
          id: crypto.randomUUID(),
          sequence: i + 1,
          occurredAt: 1,
          gameOccurredAt: 1,
          message:
            i % 2
              ? 'Rodada automática concluída'
              : 'Calendário avançado: treinos e recuperação processados',
          balances: { [clubId]: i % 2 ? 22000 : -35000 },
        })),
      },
    });
    location.hash = '/finance';
  });
  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(size);
    await page.locator('.ledger-leather-cover').click();
    const book = page.locator('.ledger-book-modal');
    await expect(book).toBeVisible();
    await expect(book.locator('.agenda-heading')).toContainText('45 lançamentos');
    const check = async () => {
      const metrics = await book.locator('.agenda-sheet:not(.agenda-overlay)').evaluate((sheet) => {
        const wrap = sheet.querySelector('.agenda-table-wrap')!;
        const rows = Array.from(sheet.querySelectorAll('tbody tr'));
        const heights = rows.map((row) => row.getBoundingClientRect().height);
        return {
          rows: rows.length,
          difference: Math.max(...heights) - Math.min(...heights),
          min: Math.min(...heights),
          fits: wrap.scrollHeight <= wrap.clientHeight + 1,
          fills:
            Math.abs(
              rows.at(-1)!.getBoundingClientRect().bottom - wrap.getBoundingClientRect().bottom,
            ) < 2,
        };
      });
      expect(metrics.rows).toBeGreaterThan(1);
      expect(metrics.difference).toBeLessThan(1);
      expect(metrics.min).toBeGreaterThanOrEqual(31);
      expect(metrics.fits).toBe(true);
      expect(metrics.fills).toBe(true);
    };
    await expect(check).toPass();
    const next = book.getByRole('button', { name: 'Virar para a próxima página' });
    while (await next.isEnabled()) {
      await next.click();
      await expect(book.locator('.agenda-pages')).toHaveAttribute('aria-busy', 'false');
    }
    await check();
    expect(await book.locator('.agenda-blank-row').count()).toBeGreaterThan(0);
    for (const row of await book.locator('.agenda-blank-row').all())
      await expect(row).toHaveText('');
    await page.screenshot({ path: `test-results/ledger-uniform-${size.width}.png` });
    await book.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
});
