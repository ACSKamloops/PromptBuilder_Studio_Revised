import { test, expect } from '@playwright/test';

test.describe('Prompt Builder studio smoke test', () => {
  test('baseline view shows library, canvas, and coach panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Block Library')).toBeVisible();
    await expect(page.getByText('Coach')).toBeVisible();
    await expect(page.getByText(/Nodes \d+ · Edges \d+/)).toBeVisible();

    // Hint: drag-and-drop is enabled in the UI, but browser automation
    // can be flaky across environments. Manual verification recommended.
  });
});
