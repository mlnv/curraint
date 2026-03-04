// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatSession } from './use-chat-session';

const chatStreamMock = vi.fn();
const cancelChatStreamMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  cancelChatStreamMock.mockResolvedValue(undefined);
  (window as unknown as { curraint: unknown }).curraint = {
    chatStream: chatStreamMock,
    cancelChatStream: cancelChatStreamMock
  };
});

describe('useChatSession', () => {
  it('submits prompt, streams deltas, and commits final assistant text', async () => {
    chatStreamMock.mockImplementation(async (_messages, onDelta) => {
      onDelta('Hel');
      onDelta('lo');
      return 'Hello';
    });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      result.current.setPrompt('  Hi  ');
      await result.current.submitPrompt('  Hi  ');
    });

    expect(result.current.conversation).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' }
    ]);
    expect(result.current.status).toBe('');
    expect(result.current.isSending).toBe(false);
    expect(result.current.prompt).toBe('');
  });

  it('edits a previous user message and truncates later history before resending', async () => {
    chatStreamMock
      .mockResolvedValueOnce('Answer 1')
      .mockResolvedValueOnce('Answer 2')
      .mockResolvedValueOnce('Edited answer');

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.submitPrompt('first');
    });

    await waitFor(() => {
      expect(result.current.conversation).toEqual([
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'Answer 1' }
      ]);
    });

    await act(async () => {
      await result.current.submitPrompt('second');
    });

    await waitFor(() => {
      expect(result.current.conversation.length).toBe(4);
    });

    act(() => {
      result.current.editUserMessage(0, 'first edited');
    });

    await waitFor(() => {
      expect(result.current.isSending).toBe(false);
    });

    expect(result.current.conversation).toEqual([
      { role: 'user', content: 'first edited' },
      { role: 'assistant', content: 'Edited answer' }
    ]);
  });

  it('requests cancel while sending and updates stopping status', async () => {
    let resolveStream: ((value: string) => void) | undefined;
    chatStreamMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveStream = resolve;
        })
    );

    const { result } = renderHook(() => useChatSession());

    act(() => {
      void result.current.submitPrompt('long request');
    });

    await waitFor(() => {
      expect(result.current.isSending).toBe(true);
    });

    act(() => {
      result.current.stopResponse();
    });

    expect(cancelChatStreamMock).toHaveBeenCalledTimes(1);
    expect(result.current.isStopping).toBe(true);
    expect(result.current.status).toBe('Stopping response...');

    await act(async () => {
      resolveStream?.('');
    });

    await waitFor(() => {
      expect(result.current.isSending).toBe(false);
    });
  });
});
