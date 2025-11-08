import { test, expect, type Page } from '@playwright/test';

const selectPreset = async (page: Page, label: string | RegExp) => {
  await page.getByTestId('flow-select').click();
  await page.getByRole('option', { name: label }).first().click();
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

    await page.getByRole('button', { name: 'Run (Preview)' }).click();
    const runDialog = page.locator('[role="dialog"]');
    await expect(runDialog).toContainText('Run ID', { timeout: 10_000 });
    await expect(runDialog).toContainText('Context-Aware Decomposition (CAD) for Long-Form Writing');
    await expect(runDialog).toContainText('Recursive Self-Improvement (RSIP): Generate–Evaluate–Improve');
    await expect(runDialog).toContainText('Chain of Verification (CoV): Draft–Plan–Execute–Finalize');
  });
});
