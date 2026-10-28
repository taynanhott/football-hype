import type { Locator } from '@playwright/test';

export async function selectOption(trigger: Locator, value: string | { index: number }) {
  await trigger.click();
  const options = trigger.page().getByRole('listbox').getByRole('option');
  if (typeof value === 'string') {
    await trigger
      .page()
      .getByRole('listbox')
      .locator(`[data-value=${JSON.stringify(value)}]`)
      .click();
  } else {
    await options.nth(value.index).click();
  }
}
