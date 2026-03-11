import { test, expect } from './fixtures';

test.describe('app launch', () => {
  test('app starts without crashing', async ({ app }) => {
    // If electron.launch() or firstWindow() throws, the test fails.
    // Reaching here means the app is running.
    const isRunning = await app.evaluate(({ app: electronApp }) => electronApp.isReady());
    expect(isRunning).toBe(true);
  });

  test('creates expected windows at startup', async ({ app }) => {
    const urls = app.windows().map((w) => w.url());
    // chat (index.html), settings, about, quick-input all created on ready
    expect(urls.some((u) => u.includes('index.html'))).toBe(true);
    expect(urls.some((u) => u.includes('settings.html'))).toBe(true);
    expect(urls.some((u) => u.includes('about.html'))).toBe(true);
    expect(urls.some((u) => u.includes('quick-input.html'))).toBe(true);
  });
});
