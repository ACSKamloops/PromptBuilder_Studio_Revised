import { test, expect } from '@playwright/test';

test.describe('Flow save/load', () => {
  test('saves JSON and loads (replace)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Flow (Save/Load)' }).click();
    const exportArea = page.getByTestId('flow-export-json');
    const json = await exportArea.inputValue();
    await expect(json).toContain('rag-retriever');
    // Replace with the same JSON to validate loader path
    const importArea = page.getByTestId('flow-import-json');
    await importArea.fill(json);
    await page.getByRole('button', { name: 'Load (Replace)' }).click();
    await expect(page.getByText(/Nodes \d+ · Edges \d+/)).toBeVisible();
  });
});
