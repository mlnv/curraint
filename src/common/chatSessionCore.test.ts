import { describe, expect, it, vi } from 'vitest';
import { createChatSessionCore, type ChatSessionState } from './chatSessionCore';

function latestState(states: ChatSessionState[]): ChatSessionState {
  return states[states.length - 1];
}

describe('chatSessionCore', () => {
  it('submits prompt and streams assistant response', async () => {
    const session = createChatSessionCore({
      streamChat: async (_messages, onDelta) => {
        onDelta('Hel');
        onDelta('lo');
        return 'Hello';
      }
    });

    const states: ChatSessionState[] = [];
    session.subscribe({
      onStateChange: (state) => states.push(state)
    });

    await session.submitPrompt('  Hi  ');

    expect(latestState(states).conversation).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' }
    ]);
    expect(latestState(states).status).toBe('');
    expect(latestState(states).isSending).toBe(false);
  });

  it('edits a user message and truncates later history before regenerating', async () => {
    const streamChat = vi
      .fn()
      .mockResolvedValueOnce('Answer 1')
      .mockResolvedValueOnce('Answer 2')
      .mockResolvedValueOnce('Edited answer');

    const session = createChatSessionCore({ streamChat });

    await session.submitPrompt('first');
    await session.submitPrompt('second');
    await session.editUserMessage(0, 'first edited');

    expect(session.getState().conversation).toEqual([
      { role: 'user', content: 'first edited' },
      { role: 'assistant', content: 'Edited answer' }
    ]);
  });

  it('stops an in-flight response and reports stopped status', async () => {
    let rejectPending: ((reason?: unknown) => void) | null = null;

    const session = createChatSessionCore({
      streamChat: (_messages, _onDelta, options) =>
        new Promise<string>((_resolve, reject) => {
          rejectPending = reject;
          options?.signal?.addEventListener('abort', () => {
            const error = new DOMException('aborted', 'AbortError');
            reject(error);
          });
        })
    });

    const states: ChatSessionState[] = [];
    session.subscribe({
      onStateChange: (state) => states.push(state)
    });

    const pending = session.submitPrompt('long request');
    await Promise.resolve();

    await session.stopResponse();
    rejectPending?.(new DOMException('aborted', 'AbortError'));
    await pending;

    expect(latestState(states).isSending).toBe(false);
    expect(latestState(states).status).toBe('Response stopped');
  });
});
