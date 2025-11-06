import { test, expect } from '@playwright/test';

const selectPreset = async (page, label: string | RegExp) => {
  await page.getByTestId('flow-select').click();
  await page.getByRole('option', { name: label }).first().click();
};

test.describe('Studio flow interactions', () => {
  test('switches to Deep Research composition and displays recommendations', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText('Optionally add RSIP after CoV for iterative refinement.', { exact: false }),
    ).toBeVisible();
    await selectPreset(page, /Deep Research — RAG \+ CoV/);
    await expect(page.getByTestId('flow-select')).toHaveText(/Deep Research — RAG \+ CoV/);
  });

  test('fills inspector field and updates prompt preview', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Block Library').click();
    await page.getByTestId('block-card-user-task').click();
    const textarea = page.getByTestId('slot-topic');
    await textarea.fill('Summarize community updates.');
    await expect(textarea).toHaveValue('Summarize community updates.');
    await expect(page.getByTestId('prompt-preview')).toContainText('Summarize community updates.');
  });

  test('run preview returns manifest with block output', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Run (Preview)' }).click();
    await expect(page.getByText(/Run ID/i)).toBeVisible();
    await expect(page.locator('text=Executed via LangGraph runnable stub').first()).toBeVisible();
    await expect(page.getByText('Output: Stubbed execution for System Mandate')).toBeVisible();
  });
});
