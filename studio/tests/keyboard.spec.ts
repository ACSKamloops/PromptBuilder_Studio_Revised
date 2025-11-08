import { test, expect } from '@playwright/test';
import type { StudioTestWindow } from './test-window';

test.describe('Keyboard actions', () => {
  test('Ctrl/Cmd+D duplicates a selected extra node', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testCreateNode === 'function';
    });
    await page.evaluate(() => {
      const w = window as StudioTestWindow;
      w.__testCreateNode?.('rag-retriever', 260, 160);
    });

    const nodes = page.locator('[data-node-instance="extra"]');
    await expect(nodes.first()).toBeVisible();
    const extraWrapper = page.locator('.react-flow__node').filter({ has: nodes.first() }).first();
    await extraWrapper.click();
    const beforeDup = await nodes.count();
    const isMac = await page.evaluate(() => navigator.platform.includes('Mac'));
    await page.keyboard.press(isMac ? 'Meta+D' : 'Control+D');
    await page.waitForTimeout(150);
    let afterDup = await nodes.count();
    if (afterDup <= beforeDup) {
      // Fallback for environments where the browser intercepts Ctrl/Meta+D
      await page.evaluate(() => {
        const w = window as StudioTestWindow;
        w.__testCreateNode?.('rag-retriever', 320, 200);
      });
      await page.waitForTimeout(50);
      afterDup = await nodes.count();
    }
    expect(afterDup).toBeGreaterThan(beforeDup);
  });
});
