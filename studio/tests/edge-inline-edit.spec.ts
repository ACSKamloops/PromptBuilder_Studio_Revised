import { test, expect } from '@playwright/test';

test.describe('Edge inline edit', () => {
  test('rename and delete user edge inline', async ({ page }) => {
    await page.goto('/');
    // Create flow with one extra node and an edge to baseline 'cov'
    await page.waitForFunction(() => typeof (window as any).__testReplaceFlow === 'function');
    await page.evaluate(() => {
      (window as any).__testReplaceFlow({
        extras: [{ id: 'rag-retriever#e2e1', baseId: 'rag-retriever', position: { x: 360, y: 160 } }],
        edges: [{ source: 'rag-retriever#e2e1', target: 'cov' }],
      });
    });

    const edgeId = 'rag-retriever#e2e1-cov-1';
    await expect(page.locator('[data-node-baseid="rag-retriever"][data-node-instance="extra"]')).toHaveCount(1);
    const label = page.getByTestId(`edge-label-${edgeId}`);
    await expect(label).toBeVisible();
    await label.click();
    await page.keyboard.type('Reviewed');
    await page.keyboard.press('Enter');
    await expect(label).toHaveText(/Reviewed/);

    // Delete via inline × button
    const del = page.getByTestId(`edge-delete-${edgeId}`);
    await del.click();
    await expect(label).toHaveCount(0);
  });
});
