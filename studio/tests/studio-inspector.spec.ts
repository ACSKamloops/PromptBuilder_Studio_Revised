import { test, expect, type Page } from '@playwright/test';
import type { RunRecord } from '@/types/run';
import type { StudioTestWindow } from './test-window';

const selectPreset = async (page: Page, label: string | RegExp) => {
  await page.getByTestId('flow-select').click();
  await page.getByRole('option', { name: label }).first().click();
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

test.describe('Studio inspector interactions', () => {
  test('rag retriever form drives preview and coach insights', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Block Library').click();
    await page.getByTestId('block-card-rag-retriever').click();

    await expect(page.getByText('Coach')).toBeVisible();
    await expect(
      page.getByText(/Use whenever factual accuracy and provenance are required/i, { exact: false }).first(),
    ).toBeVisible();

    await page.getByTestId('slot-question').fill('What emergency funds are available for coastal flooding?');
    await page.getByTestId('slot-context').fill('Snippet A: Coastal resiliency grants.\nSnippet B: Disaster relief fund.');

    const citationSelect = page.getByTestId('slot-citation_style');
    await citationSelect.click();
    await page.getByRole('option', { name: 'Footnotes' }).click();
    await expect(citationSelect).toHaveText(/Footnotes/);

    const preview = page.getByTestId('prompt-preview');
    await expect(preview).toContainText('What emergency funds are available for coastal flooding?');
    await expect(preview).toContainText('Footnotes');
    await expect(preview).toContainText('Snippet A');
  });

  test('long-form composition preset surfaces flow spec and coach guidance', async ({ page }) => {
    await page.goto('/');
    await selectPreset(page, /Long-Form Writing — CAD \+ RSIP/);

    await expect(page.getByText(/Nodes 3 · Edges 2/)).toBeVisible();

    const stubRun: RunRecord = {
      runId: 'long-form-stub',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      latencyMs: 1500,
      costUsd: 0.0003,
      usage: { promptTokens: 140, completionTokens: 90, totalTokens: 230 },
      manifest: {
        flow: { id: 'composition-long_form_writing', name: 'Long Form', description: '' },
        nodeCount: 3,
        edgeCount: 2,
        complexityScore: 6,
        blocks: [
          {
            id: 'context-aware-decomposition',
            block: 'Context-Aware Decomposition (CAD) for Long-Form Writing',
            params: {},
            output: {
              flowSummary: '',
              guidance: '',
              failureModes: '',
              acceptanceCriteria: '',
              combinesWith: [],
              compositionSteps: [],
              paramsUsed: {},
              note: 'CAD stub output',
            },
          },
          {
            id: 'recursive-self-improvement',
            block: 'Recursive Self-Improvement (RSIP): Generate–Evaluate–Improve',
            params: {},
            output: {
              flowSummary: '',
              guidance: '',
              failureModes: '',
              acceptanceCriteria: '',
              combinesWith: [],
              compositionSteps: [],
              paramsUsed: {},
              note: 'RSIP stub output',
            },
          },
          {
            id: 'cov',
            block: 'Chain of Verification (CoV): Draft–Plan–Execute–Finalize',
            params: {},
            output: {
              flowSummary: '',
              guidance: '',
              failureModes: '',
              acceptanceCriteria: '',
              combinesWith: [],
              compositionSteps: [],
              paramsUsed: {},
              note: 'CoV stub output',
            },
          },
        ],
      },
      gatingDecisions: [],
      message: 'Stubbed long-form run',
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
    await expect(runDialog.getByText('Run ID')).toBeVisible({ timeout: 10_000 });
    await expect(runDialog).toContainText('Context-Aware Decomposition (CAD) for Long-Form Writing');
    await expect(runDialog).toContainText('Recursive Self-Improvement (RSIP): Generate–Evaluate–Improve');
    await expect(runDialog).toContainText('Chain of Verification (CoV): Draft–Plan–Execute–Finalize');
  });
});
