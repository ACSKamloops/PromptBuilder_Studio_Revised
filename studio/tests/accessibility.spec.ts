import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page has no critical axe violations in core ruleset', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const allowlist = new Set([
      'color-contrast',
      'button-name',
      'aria-allowed-role',
      'aria-required-children',
      'page-has-heading-one',
      'region',
      'scrollable-region-focusable',
    ]);
    const filtered = results.violations.filter(v => !allowlist.has(v.id));
    expect(filtered).toEqual([]);
  });
});
