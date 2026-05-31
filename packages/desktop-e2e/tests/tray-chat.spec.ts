import { test, expect } from './fixtures';

test.describe('tray chat window', () => {
  test('chat window starts hidden', async ({ app }) => {
    const isVisible = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'),
      );
      return win?.isVisible() ?? null;
    });
    expect(isVisible).toBe(false);
  });

  test('chat window can be shown via main process', async ({ app }) => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'),
      );
      win?.show();
    });

    const isVisible = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'),
      );
      return win?.isVisible() ?? false;
    });
    expect(isVisible).toBe(true);
  });

  test('chat window can be toggled hidden via hideChatWindow IPC', async ({ app, chatPage }) => {
    // First show it
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'),
      );
      win?.show();
    });

    // Hide via the IPC call (same path as pressing Escape)
    await chatPage.evaluate(async () => {
      await window.curraint.hideChatWindow();
    });

    await expect
      .poll(
        () =>
          app.evaluate(({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows().find(
              (w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'),
            );
            return win?.isVisible() ?? false;
          }),
        { timeout: 5000 },
      )
      .toBe(false);
  });

  test('settings window starts hidden (opened on demand)', async ({ app }) => {
    // Like the chat window, the settings window is created with show: false
    // and only shown when the user triggers it from the tray menu.
    const isVisible = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes('settings.html'),
      );
      return win?.isVisible() ?? null;
    });
    expect(isVisible).toBe(false);
  });

  test('all expected windows are created at startup', async ({ app }) => {
    const urls = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .filter((w) => !w.isDestroyed())
        .map((w) => w.webContents.getURL()),
    );
    expect(urls.some((u) => u.includes('index.html'))).toBe(true);
    expect(urls.some((u) => u.includes('settings.html'))).toBe(true);
    expect(urls.some((u) => u.includes('about.html'))).toBe(true);
    expect(urls.some((u) => u.includes('quick-input.html'))).toBe(true);
  });
});
