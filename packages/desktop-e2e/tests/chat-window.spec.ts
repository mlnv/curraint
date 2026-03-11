import { test, expect } from './fixtures';

test.describe('chat window', () => {
  test('renders the message composer', async ({ chatPage }) => {
    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await expect(textarea).toBeVisible();
  });

  test('send button is disabled when composer is empty', async ({ chatPage }) => {
    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('');
    const sendButton = chatPage.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeDisabled();
  });

  test('send button becomes enabled when text is typed', async ({ chatPage }) => {
    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Hello');
    const sendButton = chatPage.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeEnabled();
  });

  test('clears the composer after submitting with Enter', async ({ chatPage }) => {
    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Test message');
    // Submit via Enter (same code path as clicking Send) — the prompt clears
    // synchronously on submit before any API response arrives.
    await textarea.press('Enter');
    await expect(textarea).toHaveValue('');
  });

  test('hideChatWindow IPC hides the chat window', async ({ chatPage, app }) => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'),
      );
      win?.show();
    });

    // Invoke the IPC directly from the renderer context (same path as pressing Escape)
    await chatPage.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).curraint.hideChatWindow();
    });

    // Poll — the main-process hide is async over IPC
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
});
