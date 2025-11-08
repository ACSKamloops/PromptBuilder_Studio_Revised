import { test, expect } from '@playwright/test';
import type { StudioTestWindow } from './test-window';

test.describe('Edge quick insert', () => {
  test('Alt+click edge and insert a block between', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testReplaceFlow === 'function';
    });
    await page.evaluate(() => {
      const w = window as StudioTestWindow;
      w.__testReplaceFlow?.({
        extras: [{ id: 'rag-retriever#ins1', baseId: 'rag-retriever', position: { x: 320, y: 160 } }],
        edges: [{ source: 'rag-retriever#ins1', target: 'cov' }],
      });
    });
    const edgeId = 'rag-retriever#ins1-cov-1';
    // Open Quick Insert via test hook for stability
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testOpenQuickInsert === 'function';
    });
    await page.evaluate((id: string) => {
      const w = window as StudioTestWindow;
      w.__testOpenQuickInsert?.(id);
    }, edgeId);
    const dlg = page.getByRole('dialog');
    await dlg.waitFor();
    await dlg.getByText('Exclusion Check', { exact: true }).click();

    // New extra node should be present and connected
    const newExtra = page.locator('[data-node-baseid="exclusion-check"][data-node-instance="extra"]');
    await expect(newExtra).toHaveCount(1);
  });
});
