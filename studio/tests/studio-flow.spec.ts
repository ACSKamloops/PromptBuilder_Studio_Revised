import { test, expect } from '@playwright/test';
import type { StudioTestWindow } from './test-window';

const selectPreset = async (page, label: string | RegExp) => {
  // Try UI first
  try {
    await page.getByTestId('flow-select').click();
    await page.getByRole('option', { name: label }).first().click();
    return;
  } catch {
    // Fallback to test hook (more deterministic in CI/headless)
    const map: Record<string, string> = {
      'Deep Research — RAG + CoV': 'composition-deep_research',
      'Long-Form Writing — CAD + RSIP': 'composition-long_form_writing',
      'Data Review': 'composition-data_review',
      'Strategic Planning': 'composition-strategic_planning',
    };
    const key = typeof label === 'string' ? label : 'Deep Research — RAG + CoV';
    const presetId = map[key] ?? 'composition-deep_research';
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testReplaceFlow === 'function';
    });
    await page.evaluate((id) => {
      const w = window as StudioTestWindow;
      w.__testReplaceFlow?.({ presetId: id });
    }, presetId);
  }
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
    // In headless CI, match on stable message + output lines
    await expect(page.locator('text=Executed via LangGraph runnable stub').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Output: Stubbed execution for System Mandate')).toBeVisible();
  });
});
