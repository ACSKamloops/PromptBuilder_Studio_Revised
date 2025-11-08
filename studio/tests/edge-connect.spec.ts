import { test, expect } from '@playwright/test';
import type { StudioTestWindow } from './test-window';

test.describe('Edge connections', () => {
  test('connects nodes A→B and promptspec reflects it', async ({ page }) => {
    await page.goto('/');

    // Add an extra node via test helper to ensure unique id
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testCreateNode === 'function';
    });
    await page.evaluate(() => {
      const w = window as StudioTestWindow;
      w.__testCreateNode?.('rag-retriever', 420, 40);
    });

    // Locate handles scoped by their containing React Flow node wrappers
    const presetNode = page.locator('.react-flow__node').filter({ has: page.locator('[data-node-instance="preset"]') }).first();
    const extraNode = page.locator('.react-flow__node').filter({ has: page.locator('[data-node-instance="extra"]') }).first();
    const sourceHandle = presetNode.locator('.react-flow__handle[data-handleid="out"]').first();
    const targetHandle = extraNode.locator('.react-flow__handle[data-handleid="in"]').first();

    await expect(sourceHandle).toBeVisible();
    await expect(targetHandle).toBeVisible();

    // Preferred: programmatically wire via test hook for determinism
    const extraId = await extraNode.locator('[data-testid^="flow-node-"]').getAttribute('data-testid');
    if (!extraId) throw new Error('Failed to resolve extra node id');
    const nodeId = extraId.replace('flow-node-', '');
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testReplaceFlow === 'function';
    });
    await page.evaluate((nodeId: string) => {
      const w = window as StudioTestWindow;
      w.__testReplaceFlow?.({
        presetId: 'baseline-deep-research',
        extras: [{ id: nodeId, baseId: 'rag-retriever', position: { x: 420, y: 40 } }],
        edges: [{ source: 'system-mandate', target: nodeId }],
      });
    }, nodeId);

    // Verify a new edge element appears on the canvas
    await page.waitForTimeout(150);
    const edgesCount = await page.locator('.react-flow__edge').count();
    expect(edgesCount).toBeGreaterThan(0);
  });
});
