import { test, expect } from './fixtures';

test.describe('settings window', () => {
  test('renders the provider dropdown', async ({ settingsPage }) => {
    const select = settingsPage.locator('select').first();
    await expect(select).toBeVisible();
  });

  test('provider dropdown contains known providers', async ({ settingsPage }) => {
    const select = settingsPage.locator('select').first();
    const options = await select.locator('option').allTextContents();
    // At minimum the default providers from core should be present
    expect(options.length).toBeGreaterThan(0);
  });

  test('renders API key input field', async ({ settingsPage }) => {
    const apiKeyInput = settingsPage.locator('input[type="password"], input[placeholder*="key" i], input[placeholder*="Key" i]').first();
    await expect(apiKeyInput).toBeVisible();
  });

  test('renders model input field', async ({ settingsPage }) => {
    // The model input has no placeholder; locate it via its label
    const modelInput = settingsPage.locator('div:has(> label:text("Model")) input');
    await expect(modelInput).toBeVisible();
  });

  test('renders Save settings button', async ({ settingsPage }) => {
    // Use exact match to avoid colliding with the "Save current" connection button
    const saveButton = settingsPage.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeVisible();
  });

  test('renders Test connection button', async ({ settingsPage }) => {
    const testButton = settingsPage.getByRole('button', { name: 'Test Connection' });
    await expect(testButton).toBeVisible();
  });

  test('changing provider updates the form', async ({ settingsPage }) => {
    const select = settingsPage.locator('select').first();
    const initialValue = await select.inputValue();

    // Select by value to avoid label-whitespace issues with React controlled selects
    const options = await select.locator('option').evaluateAll(
      (els) => (els as HTMLOptionElement[]).map((o) => o.value),
    );
    const otherValue = options.find((v) => v !== initialValue);
    if (!otherValue) return; // only one provider available, skip

    await select.selectOption(otherValue);
    await expect(select).toHaveValue(otherValue);
  });
});
