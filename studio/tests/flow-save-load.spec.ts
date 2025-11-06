import { test, expect } from '@playwright/test';

test.describe('Flow save/load', () => {
  test('saves JSON and loads (replace)', async ({ page }) => {
    await page.goto('/');
    // Create a node so export JSON is non-trivial
    await page.waitForFunction(() => typeof (window as unknown as { __testCreateNode?: (id: string, x?: number, y?: number) => void }).__testCreateNode === 'function');
    await page.evaluate(() => (window as unknown as { __testCreateNode: (id: string, x?: number, y?: number) => void }).__testCreateNode('rag-retriever', 260, 160));

    await page.getByRole('button', { name: 'Flow (Save/Load)' }).click();
    const exportArea = page.getByTestId('flow-export-json');
    const json = await exportArea.inputValue();
    await expect(json).toContain('rag-retriever');
    // Replace with the same JSON to validate loader path
    const importArea = page.getByTestId('flow-import-json');
    await importArea.fill(json);
    await page.getByRole('button', { name: 'Load (Replace)' }).click();
    // Verify at least one extra node exists on canvas
    await expect(page.locator('[data-node-instance="extra"]').first()).toBeVisible();
  });
});

