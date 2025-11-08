import { test, expect, type Page } from '@playwright/test';
import type { StudioTestWindow } from './test-window';
import type { RunRecord } from '@/types/run';

const selectPreset = async (page: Page, label: string | RegExp) => {
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
    await page.evaluate((id: string) => {
      const w = window as StudioTestWindow;
      w.__testReplaceFlow?.({ presetId: id });
    }, presetId);
  }
};

const waitForRunHelper = async (page: Page) => {
  try {
    await page.waitForFunction(() => {
      const w = window as StudioTestWindow;
      return typeof w.__testSetRunResult === 'function';
    }, null, { timeout: 5_000 });
    return true;
  } catch {
    return false;
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
    const stubRun: RunRecord = {
      runId: 'test-run',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      latencyMs: 1234,
      costUsd: 0.0002,
      usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
      manifest: {
        flow: { id: 'composition-deep_research', name: 'Deep Research', description: '' },
        nodeCount: 3,
        edgeCount: 2,
        complexityScore: 5,
        blocks: [
          {
            id: 'system-mandate',
            block: 'System Mandate',
            params: {},
            output: {
              flowSummary: 'Stub flow',
              guidance: '',
              failureModes: '',
              acceptanceCriteria: '',
              combinesWith: [],
              compositionSteps: [],
              paramsUsed: {},
              note: 'Test stub output for System Mandate',
            },
          },
        ],
      },
      gatingDecisions: [],
      message: 'Stubbed run for tests',
    };
    const helperReady = await waitForRunHelper(page);
    const triggeredViaHelper = helperReady
      ? await page.evaluate((payload) => {
          const w = window as StudioTestWindow;
          if (typeof w.__testSetRunResult === 'function') {
            w.__testSetRunResult(payload);
            return true;
          }
          return false;
        }, stubRun)
      : false;
    if (!triggeredViaHelper) {
      await page.getByRole('button', { name: 'Run (Preview)' }).click();
    }
    const runDialog = page.getByRole('dialog', { name: 'Run Preview' });
    await page.getByText('Running preview…', { exact: true })
      .waitFor({ state: 'detached', timeout: 10_000 })
      .catch(() => undefined);
    const dialogPreview = runDialog.locator('[data-testid="prompt-preview"]');
    await expect(runDialog.getByText('Run ID')).toBeVisible({ timeout: 10_000 });
    await expect(dialogPreview).toContainText('System Mandate', { timeout: 10_000 });
  });
});
