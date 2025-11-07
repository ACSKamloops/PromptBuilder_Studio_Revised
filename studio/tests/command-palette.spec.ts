import { test, expect } from '@playwright/test';

test.describe('Global command palette', () => {
  test('add block and switch flow via palette', async ({ page }) => {
    await page.goto('/');

    // Open palette and add RAG Retriever
    const openPalette = async () => {
      await page.waitForFunction(() => typeof (window as any).__testOpenCommandPalette === 'function');
      await page.evaluate(() => (window as any).__testOpenCommandPalette?.());
      const input = page.getByTestId('command-palette-input');
      await input.waitFor({ state: 'visible' });
      return input;
    };

    let paletteInput = await openPalette();
    await paletteInput.fill('rag retriever');
    await page.getByRole('option', { name: /Add: RAG Retriever/i }).first().click();
    await expect(page.locator('[data-node-baseid="rag-retriever"][data-node-instance="extra"]')).toHaveCount(1);

    // Open palette and switch to Deep Research flow
    paletteInput = await openPalette();
    await paletteInput.fill('Deep Research');
    await page.getByRole('option', { name: /Switch: Deep Research/i }).first().click();
    // Assert select shows Deep Research
    await expect(page.getByTestId('flow-select')).toContainText('Deep Research');
  });
});
