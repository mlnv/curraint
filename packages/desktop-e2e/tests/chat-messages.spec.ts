import { test, expect } from './fixtures';
import type { ElectronApplication } from '@playwright/test';

const STREAM_CHANNEL = 'chat:stream';
const CHUNK_CHANNEL = 'chat:stream:chunk';

/**
 * Replaces the real chatStream IPC handler in the main process with a mock
 * that sends the given chunks then resolves. Safe to call per-test since each
 * test gets its own fresh app instance.
 */
async function mockChatStream(
  app: ElectronApplication,
  chunks: string[],
  delayMs = 60,
): Promise<void> {
  const fullResponse = chunks.join('');
  await app.evaluate(
    ({ ipcMain }, args) => {
      ipcMain.removeHandler(args.streamChannel);
      ipcMain.handle(
        args.streamChannel,
        (event, payload: { requestId: string }) =>
          new Promise<string>((resolve) => {
            let i = 0;
            const sendNext = (): void => {
              if (i < args.chunks.length) {
                event.sender.send(args.chunkChannel, {
                  requestId: payload.requestId,
                  delta: args.chunks[i++],
                });
                setTimeout(sendNext, args.delayMs);
              } else {
                resolve(args.fullResponse);
              }
            };
            sendNext();
          }),
      );
    },
    { streamChannel: STREAM_CHANNEL, chunkChannel: CHUNK_CHANNEL, chunks, delayMs, fullResponse },
  );
}

test.describe('chat messages (mocked API)', () => {
  test('user message appears immediately after submitting', async ({ chatPage, app }) => {
    await mockChatStream(app, ['ok']);

    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Hello world');
    await textarea.press('Enter');

    // User bubble has bg-primary; look for the submitted text inside it
    await expect(
      chatPage.locator('[class*="rounded-br-sm"]').filter({ hasText: 'Hello world' }),
    ).toBeVisible();
  });

  test('shows Stop response button while stream is in progress', async ({ chatPage, app }) => {
    // Use a longer delay so we can observe the streaming state
    await mockChatStream(app, ['chunk1 ', 'chunk2 ', 'chunk3'], 100);

    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Test streaming');
    await textarea.press('Enter');

    // Stop response button is shown when isSending === true
    await expect(chatPage.getByRole('button', { name: 'Stop response' })).toBeVisible();
  });

  test('assistant response appears after stream completes', async ({ chatPage, app }) => {
    await mockChatStream(app, ['Hello ', 'from ', 'mock!']);

    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Say hello');
    await textarea.press('Enter');

    // Assistant bubble has rounded-bl-sm; wait for the full text
    await expect(
      chatPage.locator('[class*="rounded-bl-sm"]').filter({ hasText: 'Hello from mock!' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Send button returns after stream completes', async ({ chatPage, app }) => {
    await mockChatStream(app, ['Done!'], 30);

    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Quick question');
    await textarea.press('Enter');

    // After the stream resolves, Stop response disappears and Send comes back
    await expect(chatPage.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 10_000 });
  });

  test('multiple exchanges accumulate in the conversation', async ({ chatPage, app }) => {
    await mockChatStream(app, ['First answer.']);
    const textarea = chatPage.getByPlaceholder('Ask anything...');

    await textarea.fill('First question');
    await textarea.press('Enter');
    await expect(
      chatPage.locator('[class*="rounded-bl-sm"]').filter({ hasText: 'First answer.' }),
    ).toBeVisible({ timeout: 10_000 });
    // Ensure the stream has fully settled (Stop response gone = isSending false)
    // before submitting the second message, otherwise submitPrompt early-returns.
    await expect(chatPage.getByRole('button', { name: 'Stop response' })).toBeHidden();

    // Re-install mock for the second exchange (same app, handler already replaced once)
    await mockChatStream(app, ['Second answer.']);
    await textarea.fill('Second question');
    // Wait until Send is enabled (prompt non-empty + not currently sending)
    await expect(chatPage.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await textarea.press('Enter');

    await expect(
      chatPage.locator('[class*="rounded-bl-sm"]').filter({ hasText: 'Second answer.' }),
    ).toBeVisible({ timeout: 10_000 });

    // Both user messages should still be visible
    await expect(
      chatPage.locator('[class*="rounded-br-sm"]').filter({ hasText: 'First question' }),
    ).toBeVisible();
    await expect(
      chatPage.locator('[class*="rounded-br-sm"]').filter({ hasText: 'Second question' }),
    ).toBeVisible();
  });

  test('shows response duration after stream completes', async ({ chatPage, app }) => {
    await mockChatStream(app, ['Hello ', 'world!'], 30);

    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Duration test');
    await textarea.press('Enter');

    // Wait for stream to finish (Send button returns)
    await expect(chatPage.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 10_000 });

    // Hover over the assistant bubble to reveal the hover-only metadata row
    const assistantBubble = chatPage.locator('[class*="rounded-bl-sm"]').filter({ hasText: 'Hello world!' });
    await assistantBubble.hover();

    // Duration label should be visible (opacity transitions on hover via group-hover:opacity-100)
    const durationLabel = chatPage.locator('[data-testid="response-duration"]');
    await expect(durationLabel).toBeVisible({ timeout: 5_000 });
    // Should match e.g. "12ms" or "1.2s"
    await expect(durationLabel).toHaveText(/^\d+(\.\d+)?(ms|s)$/);
  });

  test('does not show duration while stream is in progress', async ({ chatPage, app }) => {
    await mockChatStream(app, ['chunk1 ', 'chunk2 ', 'chunk3'], 200);

    const textarea = chatPage.getByPlaceholder('Ask anything...');
    await textarea.fill('Slow stream');
    await textarea.press('Enter');

    // While streaming is happening, Stop button is visible
    await expect(chatPage.getByRole('button', { name: 'Stop response' })).toBeVisible();

    // Duration label should not yet be present
    await expect(chatPage.locator('[data-testid="response-duration"]')).toBeHidden();
  });
});
