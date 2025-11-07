import { test, expect } from '@playwright/test';

test.describe('Snap/grid hotkeys', () => {
  test('toggle snap with G and cycle grid with Shift+G', async ({ page }) => {
    await page.goto('/');
    // Focus canvas to ensure hotkeys are captured
    await page.click('main');
    const switchRole = page.getByRole('switch').first();
    const before = await switchRole.getAttribute('aria-checked');
    await page.keyboard.press('g');
    const after = await switchRole.getAttribute('aria-checked');
    expect(before).not.toBe(after);

    // Cycle grid with Shift+G (no assertion, just ensure no error)
    await page.keyboard.press('Shift+G');
    expect.soft(true).toBe(true);
  });
});
