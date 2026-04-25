import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../ipc';
import { DEFAULT_APP_SETTINGS } from '../appSettings';

const {
  handlers,
  ipcHandleMock,
  chatCompletionMock,
  chatCompletionStreamMock,
  copilotChatCompleteMock,
  testConnectionMock
} = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcHandleMock = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });
  return {
    handlers,
    ipcHandleMock,
    chatCompletionMock: vi.fn(),
    chatCompletionStreamMock: vi.fn(),
    copilotChatCompleteMock: vi.fn(),
    testConnectionMock: vi.fn()
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandleMock
  }
}));

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    chatCompletion: chatCompletionMock,
    chatCompletionStream: chatCompletionStreamMock,
    copilotChatComplete: copilotChatCompleteMock,
    testConnection: testConnectionMock
  };
});

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
  });

  it('validates chat payload before send', async () => {
    const { registerIpcHandlers } = await import('./ipcHandlers');
    registerIpcHandlers({
      getSettings: () => DEFAULT_APP_SETTINGS,
      saveSettings: (next) => next
    });

    const chatSend = handlers.get(IPC_CHANNELS.chatSend);
    await expect(chatSend?.({}, 'invalid')).rejects.toThrow('Invalid chat payload.');
  });

  it.each(['openai', 'custom', 'lmstudio'] as const)(
    'routes summarize through chatCompletion for %s',
    async (provider) => {
      chatCompletionMock.mockResolvedValue({ message: `${provider} summary` });

      const { registerIpcHandlers } = await import('./ipcHandlers');
      registerIpcHandlers({
        getSettings: () => ({ ...DEFAULT_APP_SETTINGS, provider }),
        saveSettings: (next) => next
      });

      const chatSummarize = handlers.get(IPC_CHANNELS.chatSummarize);
      const messages = [{ role: 'user', content: 'Summarize this' }];
      const result = await chatSummarize?.({}, messages);

      expect(result).toBe(`${provider} summary`);
      expect(chatCompletionMock).toHaveBeenCalledWith(
        expect.objectContaining({ provider }),
        messages
      );
      expect(copilotChatCompleteMock).not.toHaveBeenCalled();
    }
  );

  it('routes summarize through copilotChatComplete for copilot', async () => {
    copilotChatCompleteMock.mockResolvedValue({ message: 'copilot summary' });

    const { registerIpcHandlers } = await import('./ipcHandlers');
    registerIpcHandlers({
      getSettings: () => ({ ...DEFAULT_APP_SETTINGS, provider: 'copilot', baseUrl: '', apiKey: '' }),
      saveSettings: (next) => next
    });

    const chatSummarize = handlers.get(IPC_CHANNELS.chatSummarize);
    const messages = [{ role: 'user', content: 'Summarize this' }];
    const result = await chatSummarize?.({}, messages);

    expect(result).toBe('copilot summary');
    expect(copilotChatCompleteMock).toHaveBeenCalledWith(DEFAULT_APP_SETTINGS.model, messages);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('streams deltas and returns final streamed message', async () => {
    chatCompletionStreamMock.mockImplementation(async (_settings, _messages, callbacks) => {
      callbacks.onDelta('Hello ');
      callbacks.onDelta('world');
      return { message: 'Hello world' };
    });

    const onAssistantMessage = vi.fn();
    const send = vi.fn();

    const { registerIpcHandlers } = await import('./ipcHandlers');
    registerIpcHandlers({
      getSettings: () => DEFAULT_APP_SETTINGS,
      saveSettings: (next) => next,
      onAssistantMessage
    });

    const chatStream = handlers.get(IPC_CHANNELS.chatStream);
    const result = await chatStream?.(
      { sender: { send } },
      { requestId: 'req-1', messages: [{ role: 'user', content: 'Hi' }] }
    );

    expect(result).toEqual({ text: 'Hello world', usage: undefined });
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.chatStreamChunk, {
      requestId: 'req-1',
      delta: 'Hello '
    });
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.chatStreamChunk, {
      requestId: 'req-1',
      delta: 'world'
    });
    expect(onAssistantMessage).toHaveBeenCalledTimes(1);
  });

  it('falls back to non-stream completion when stream fails before first chunk', async () => {
    chatCompletionStreamMock.mockRejectedValue(new Error('stream unsupported'));
    chatCompletionMock.mockResolvedValue({ message: 'Fallback response' });

    const onAssistantMessage = vi.fn();

    const { registerIpcHandlers } = await import('./ipcHandlers');
    registerIpcHandlers({
      getSettings: () => DEFAULT_APP_SETTINGS,
      saveSettings: (next) => next,
      onAssistantMessage
    });

    const chatStream = handlers.get(IPC_CHANNELS.chatStream);
    const result = await chatStream?.(
      { sender: { send: vi.fn() } },
      { requestId: 'req-2', messages: [{ role: 'user', content: 'Hi' }] }
    );

    expect(result).toEqual({ text: 'Fallback response', usage: undefined });
    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    expect(onAssistantMessage).toHaveBeenCalledTimes(1);
  });

  it('returns partial streamed content on abort and does not call assistant callback', async () => {
    chatCompletionStreamMock.mockImplementation(
      async (_settings, _messages, callbacks, options) =>
        new Promise((_resolve, reject) => {
          callbacks.onDelta('partial');
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'));
          });
        })
    );

    const onAssistantMessage = vi.fn();

    const { registerIpcHandlers } = await import('./ipcHandlers');
    registerIpcHandlers({
      getSettings: () => DEFAULT_APP_SETTINGS,
      saveSettings: (next) => next,
      onAssistantMessage
    });

    const chatStream = handlers.get(IPC_CHANNELS.chatStream);
    const chatCancel = handlers.get(IPC_CHANNELS.chatCancel);

    const streamPromise = chatStream?.(
      { sender: { send: vi.fn() } },
      { requestId: 'req-3', messages: [{ role: 'user', content: 'Hi' }] }
    );

    await chatCancel?.({}, 'req-3');

    await expect(streamPromise).resolves.toEqual({ text: 'partial' });
    expect(onAssistantMessage).not.toHaveBeenCalled();
  });

  it('wires testConnection through normalized settings handler', async () => {
    testConnectionMock.mockResolvedValue('ok');

    const { registerIpcHandlers } = await import('./ipcHandlers');
    registerIpcHandlers({
      getSettings: () => DEFAULT_APP_SETTINGS,
      saveSettings: (next) => next
    });

    const handler = handlers.get(IPC_CHANNELS.testConnection);
    const result = await handler?.({}, { ...DEFAULT_APP_SETTINGS, apiKey: '  key  ' });

    expect(testConnectionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe('ok');
  });
});
