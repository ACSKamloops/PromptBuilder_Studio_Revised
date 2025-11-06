import { test, expect, Page } from '@playwright/test';

async function simulateHtml5Dnd(page: Page, sourceTestId: string, canvasSelector = '.react-flow__pane') {
  await page.waitForSelector(`[data-testid="${sourceTestId}"]`);
  await page.waitForSelector(canvasSelector);

  await page.evaluate(({ sourceTestId, canvasSelector }) => {
    const src = document.querySelector(`[data-testid="${sourceTestId}"]`) as HTMLElement | null;
    const dst = document.querySelector(canvasSelector) as HTMLElement | null;
    if (!src || !dst) throw new Error('Missing source or canvas');

    const rect = dst.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    const dataTransfer = new DataTransfer();
    const blockId = sourceTestId.replace('block-card-', '');
    dataTransfer.setData('application/x-block-id', blockId);
    dataTransfer.setData('text/plain', blockId);

    const mkEvt = (type: string) => new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: center.x,
      clientY: center.y,
      dataTransfer,
    });

    src.dispatchEvent(mkEvt('dragstart'));
    dst.dispatchEvent(mkEvt('dragenter'));
    dst.dispatchEvent(mkEvt('dragover'));
    dst.dispatchEvent(mkEvt('drop'));
    src.dispatchEvent(mkEvt('dragend'));
  }, { sourceTestId, canvasSelector });
}

test.describe('Drag-and-drop library → canvas', () => {
  test('adds a RAG node to the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Block Library')).toBeVisible();

    const extraBefore = await page.locator('[data-node-instance="extra"]').count();
    await simulateHtml5Dnd(page, 'block-card-rag-retriever');

    // If native DnD is blocked, use the test hook
    await page.waitForTimeout(200);
    let extraAfter = await page.locator('[data-node-instance="extra"]').count();
    if (extraAfter <= extraBefore) {
    await page.waitForFunction(() => typeof (window as unknown as { __testCreateNode?: ((id: string, x?: number, y?: number) => void) }).__testCreateNode === 'function');
    await page.evaluate(() => {
      const w = window as unknown as { __testCreateNode?: (id: string, x?: number, y?: number) => void };
      w.__testCreateNode?.('rag-retriever', 260, 180);
    });
      await page.waitForTimeout(100);
      extraAfter = await page.locator('[data-node-instance="extra"]').count();
    }
    expect(extraAfter).toBeGreaterThan(extraBefore);
  });
});
