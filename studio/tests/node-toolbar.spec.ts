import { test, expect } from '@playwright/test';
import type { StudioTestWindow } from './test-window';

test.describe('Node context menu', () => {
  test('duplicate and delete via context menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testCreateNode === 'function';
    });
    await page.evaluate(() => {
      const w = window as StudioTestWindow;
      w.__testCreateNode?.('rag-retriever', 320, 160);
    });
    const firstId = await page.evaluate(() => {
      const w = window as StudioTestWindow;
      return w.__testGetExtraIds?.()?.[0];
    });
    await page.evaluate((id) => {
      const w = window as StudioTestWindow;
      w.__testOpenNodeMenu?.(id);
    }, firstId);
    const duplicateBtn = page.getByTestId('node-menu-duplicate');
    await duplicateBtn.scrollIntoViewIfNeeded();
    await duplicateBtn.click();
    await expect(page.locator('[data-node-instance="extra"]')).toHaveCount(2);

    // Delete one via context menu
    await page.evaluate((id) => {
      const w = window as StudioTestWindow;
      w.__testOpenNodeMenu?.(id);
    }, firstId);
    const deleteBtn = page.getByTestId('node-menu-delete');
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click();
    await expect(page.locator('[data-node-instance="extra"]')).toHaveCount(1);
  });
});
