// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedSession } from '@curraint/core';
import { useChatSession } from './use-chat-session';

const chatStreamMock = vi.fn();
const summarizeMessagesMock = vi.fn();
const cancelChatStreamMock = vi.fn();
const clearChatSessionMock = vi.fn();
const getSettingsMock = vi.fn();
const saveSessionMock = vi.fn();
const onSettingsChangedMock = vi.fn();
const onSessionLoadMock = vi.fn();

// Strip timestamps before equality checks — tests don't care about exact values.
const stripTs = (msgs: { role: string; content: string; timestamp?: number }[]) =>
  msgs.map(({ role, content }) => ({ role, content }));

function makeCurraint(overrides: Record<string, unknown> = {}): unknown {
  return {
    chatStream: chatStreamMock,
    summarizeMessages: summarizeMessagesMock,
    cancelChatStream: cancelChatStreamMock,
    clearChatSession: clearChatSessionMock,
    getSettings: getSettingsMock,
    saveSession: saveSessionMock,
    onSettingsChanged: onSettingsChangedMock,
    onSessionLoad: onSessionLoadMock,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  summarizeMessagesMock.mockResolvedValue('Condensed summary');
  cancelChatStreamMock.mockResolvedValue(undefined);
  clearChatSessionMock.mockResolvedValue(undefined);
  getSettingsMock.mockResolvedValue({ enableSessionSaving: false });
  saveSessionMock.mockResolvedValue(undefined);
  onSettingsChangedMock.mockReturnValue(() => undefined);
  onSessionLoadMock.mockReturnValue(() => undefined);
  (window as unknown as { curraint: unknown }).curraint = makeCurraint();
});

describe('useChatSession', () => {
  it('submits prompt, streams deltas, and commits final assistant text', async () => {
    chatStreamMock.mockImplementation(async (_messages, onDelta) => {
      onDelta('Hel');
      onDelta('lo');
      return { text: 'Hello' };
    });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      result.current.setPrompt('  Hi  ');
      await result.current.submitPrompt('  Hi  ');
    });

    expect(stripTs(result.current.conversation)).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' }
    ]);
    expect(result.current.status).toBe('');
    expect(result.current.isSending).toBe(false);
    expect(result.current.prompt).toBe('');
  });

  it('edits a previous user message and truncates later history before resending', async () => {
    chatStreamMock
      .mockResolvedValueOnce({ text: 'Answer 1' })
      .mockResolvedValueOnce({ text: 'Answer 2' })
      .mockResolvedValueOnce({ text: 'Edited answer' });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.submitPrompt('first');
    });

    await waitFor(() => {
      expect(stripTs(result.current.conversation)).toEqual([
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

    expect(stripTs(result.current.conversation)).toEqual([
      { role: 'user', content: 'first edited' },
      { role: 'assistant', content: 'Edited answer' }
    ]);
  });

  it('requests cancel while sending and updates stopping status', async () => {
    let resolveStream: ((value: { text: string }) => void) | undefined;
    chatStreamMock.mockImplementation(
      () =>
        new Promise<{ text: string }>((resolve) => {
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
      resolveStream?.({ text: '' });
    });

    await waitFor(() => {
      expect(result.current.isSending).toBe(false);
    });
  });

  it('loadSession replaces conversation without calling chatStream', async () => {
    const session: SavedSession = {
      id: '123-abcd',
      title: 'Hello there',
      createdAt: 1000,
      updatedAt: 2000,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ]
    };

    const { result } = renderHook(() => useChatSession());

    act(() => {
      result.current.loadSession(session);
    });

    expect(result.current.conversation).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' }
    ]);
    expect(chatStreamMock).not.toHaveBeenCalled();
  });

  it('auto-saves session twice per exchange (on submit and on completion) when saving is enabled', async () => {
    getSettingsMock.mockResolvedValue({ enableSessionSaving: true });

    chatStreamMock.mockResolvedValue({ text: 'Reply' });

    const { result } = renderHook(() => useChatSession());

    // Allow the getSettings effect to resolve.
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.submitPrompt('Hello');
    });

    await waitFor(() => {
      expect(result.current.isSending).toBe(false);
    });

    // Called twice: once when the user message is submitted (early save so the
    // session appears in the list while streaming), and once when the response
    // completes with the full exchange.
    expect(saveSessionMock).toHaveBeenCalledTimes(2);
    const saved = saveSessionMock.mock.calls[1][0] as SavedSession;
    expect(saved.title).toBe('Hello');
    expect(stripTs(saved.messages)).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Reply' }
    ]);
  });

  it('does NOT auto-save when session saving is disabled', async () => {
    getSettingsMock.mockResolvedValue({ enableSessionSaving: false });

    chatStreamMock.mockResolvedValue({ text: 'Reply' });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.submitPrompt('Hello');
    });

    await waitFor(() => {
      expect(result.current.isSending).toBe(false);
    });

    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it('clears session ID when clearConversation is called so next exchange gets a new ID', async () => {
    getSettingsMock.mockResolvedValue({ enableSessionSaving: true });
    chatStreamMock.mockResolvedValueOnce({ text: 'Reply' }).mockResolvedValueOnce({ text: 'Reply 2' });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await Promise.resolve();
    });

    // First exchange — creates a session ID.
    await act(async () => {
      await result.current.submitPrompt('First');
    });

    await waitFor(() => expect(result.current.isSending).toBe(false));
    // Each exchange triggers 2 saves (early + completion). Use calls[0] for the first exchange ID.
    const firstCallId = (saveSessionMock.mock.calls[0][0] as SavedSession).id;

    // Clear the conversation.
    await act(async () => {
      await result.current.clearConversation();
    });

    // Second exchange — should generate a NEW session ID.
    await act(async () => {
      await result.current.submitPrompt('Second');
    });

    await waitFor(() => expect(result.current.isSending).toBe(false));
    // calls[2] is the early save of the second exchange (calls[0..1] belong to the first).
    const secondCallId = (saveSessionMock.mock.calls[2][0] as SavedSession).id;

    expect(firstCallId).not.toBe(secondCallId);
  });

  it('auto-saves when only compacted context changes', async () => {
    getSettingsMock.mockResolvedValue({ enableSessionSaving: true });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.loadSession({
        id: 'session-1',
        title: 'Loaded session',
        createdAt: 1000,
        updatedAt: 2000,
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Reply' },
          { role: 'user', content: 'Second' },
        ],
      });
    });

    await act(async () => {
      await result.current.summarizeContext({ maxMessages: 1, maxCharacters: 2000 });
    });

    expect(summarizeMessagesMock).toHaveBeenCalledTimes(1);
    expect(summarizeMessagesMock).toHaveBeenCalledWith(
      [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Reply' },
      ],
      undefined,
    );
    expect(saveSessionMock).toHaveBeenCalledTimes(1);
    const saved = saveSessionMock.mock.calls[0][0] as SavedSession;
    expect(saved.compactedContext).toMatchObject({
      summary: 'Condensed summary'
    });
    expect(saved.compactedContext?.sourceMessageCount).toBe(2);
  });
});
