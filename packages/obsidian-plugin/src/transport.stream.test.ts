import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestUrl, chatCompletionStream, composeConversation } = vi.hoisted(() => ({
  requestUrl: vi.fn(),
  chatCompletionStream: vi.fn(),
  composeConversation: vi.fn(),
}));

vi.mock('obsidian', () => ({
  requestUrl,
  Platform: { isMobile: false },
}));

vi.mock('@curraint/core', () => ({
  chatCompletionStream,
  composeConversation,
}));

import { buildTransport } from './transport';
import type CurraintPlugin from './main';

describe('buildTransport abort handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    composeConversation.mockImplementation((_settings, messages) => messages);
  });

  it('does not start the non-streaming fallback when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    chatCompletionStream.mockRejectedValueOnce(new Error('stream failed'));

    const plugin = {
      settings: {
        provider: 'openai',
        apiKeyEncrypted: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        systemPrompt: '',
        contextMaxMessages: 40,
        contextMaxCharacters: 24000,
        enableSessionSaving: false,
        mobileDeviceKey: '',
      },
      secrets: { decrypt: vi.fn(), encrypt: vi.fn() },
    } satisfies Pick<CurraintPlugin, 'settings' | 'secrets'>;

    const transport = buildTransport(plugin);

    const onDelta = vi.fn();
    const result = await transport.streamChat(
      [{ role: 'user', content: 'Hello' }],
      onDelta,
      { signal: controller.signal }
    );

    expect(result).toEqual({ text: '' });
    expect(requestUrl).not.toHaveBeenCalled();
    expect(onDelta).not.toHaveBeenCalled();
  });

  it('drops the non-streaming fallback result when the signal aborts while waiting', async () => {
    const controller = new AbortController();
    chatCompletionStream.mockRejectedValueOnce(new Error('stream failed'));
    requestUrl.mockImplementationOnce(async () => {
      controller.abort();
      return {
        status: 200,
        json: {
          choices: [{ message: { content: 'Fallback response' } }],
        },
        text: '',
      };
    });

    const plugin = {
      settings: {
        provider: 'openai',
        apiKeyEncrypted: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        systemPrompt: '',
        contextMaxMessages: 40,
        contextMaxCharacters: 24000,
        enableSessionSaving: false,
        mobileDeviceKey: '',
      },
      secrets: { decrypt: vi.fn(), encrypt: vi.fn() },
    } satisfies Pick<CurraintPlugin, 'settings' | 'secrets'>;

    const transport = buildTransport(plugin);

    const onDelta = vi.fn();
    const result = await transport.streamChat(
      [{ role: 'user', content: 'Hello' }],
      onDelta,
      { signal: controller.signal }
    );

    expect(result).toEqual({ text: '' });
    expect(requestUrl).toHaveBeenCalledTimes(1);
    expect(onDelta).not.toHaveBeenCalled();
  });
});