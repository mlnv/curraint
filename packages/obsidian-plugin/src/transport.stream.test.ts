import { beforeEach, describe, expect, it, vi } from 'vitest';

const { Platform, buildModelSummaryMessages, requestUrl, chatCompletionStream, composeConversation } = vi.hoisted(() => ({
  Platform: { isMobile: false },
  buildModelSummaryMessages: vi.fn(),
  requestUrl: vi.fn(),
  chatCompletionStream: vi.fn(),
  composeConversation: vi.fn(),
}));

vi.mock('obsidian', () => ({
  requestUrl,
  Platform,
}));

vi.mock('@curraint/core', () => ({
  buildModelSummaryMessages,
  chatCompletionStream,
  composeConversation,
}));

import { buildTransport } from './transport';
import type CurraintPlugin from './main';

describe('buildTransport abort handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Platform.isMobile = false;
    buildModelSummaryMessages.mockImplementation((messages) => messages);
    composeConversation.mockImplementation((_settings, messages) => messages);
  });

  it('rejects LM Studio summaries on mobile', async () => {
    Platform.isMobile = true;

    const plugin = {
      settings: {
        provider: 'lmstudio',
        apiKeyEncrypted: '',
        baseUrl: 'http://localhost:1234',
        model: 'qwen2.5-7b',
        systemPrompt: '',
        contextMaxMessages: 40,
        contextMaxCharacters: 24000,
        enableSessionSaving: false,
        mobileDeviceKey: '',
      },
      secrets: { decrypt: vi.fn(), encrypt: vi.fn() },
    } satisfies Pick<CurraintPlugin, 'settings' | 'secrets'>;

    const transport = buildTransport(plugin);

    await expect(transport.summarizeMessages([{ role: 'user', content: 'Hello' }])).rejects.toThrow(
      'LM Studio is not available on mobile. Switch to a cloud provider in Settings.'
    );
    expect(requestUrl).not.toHaveBeenCalled();
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

  it('clears stale LM Studio response ids after a compacted-context fallback', async () => {
    const lmStudioBodies: Array<Record<string, unknown>> = [];
    chatCompletionStream.mockRejectedValueOnce(new Error('stream unsupported'));
    requestUrl.mockImplementation(async (request) => {
      if (request.url.endsWith('/api/v1/chat')) {
        const body = JSON.parse(String(request.body)) as Record<string, unknown>;
        lmStudioBodies.push(body);
        return {
          status: 200,
          json: {
            output: [{ type: 'message', content: 'Native response' }],
            response_id: 'resp-1',
          },
          text: '',
        };
      }

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
        provider: 'lmstudio',
        apiKeyEncrypted: '',
        baseUrl: 'http://localhost:1234',
        model: 'qwen2.5-7b',
        systemPrompt: '',
        contextMaxMessages: 40,
        contextMaxCharacters: 24000,
        enableSessionSaving: false,
        mobileDeviceKey: '',
      },
      secrets: { decrypt: vi.fn(), encrypt: vi.fn() },
    } satisfies Pick<CurraintPlugin, 'settings' | 'secrets'>;

    const transport = buildTransport(plugin);

    await transport.streamChat([{ role: 'user', content: 'First' }], vi.fn());
    await transport.streamChat(
      [{ role: 'user', content: 'Second' }],
      vi.fn(),
      {
        compactedContext: {
          summary: 'Earlier context',
          sourceMessageCount: 1,
          sourceCharacterCount: 20,
        },
      }
    );
    // lmStudioBodies only records native /api/v1/chat fallback requests, so
    // the third call intentionally stays on the streaming success path.
    await transport.streamChat([{ role: 'user', content: 'Third' }], vi.fn());

    expect(lmStudioBodies).toHaveLength(2);
    expect(lmStudioBodies[0]?.previous_response_id).toBeUndefined();
    expect(lmStudioBodies[1]?.previous_response_id).toBeUndefined();
  });
});