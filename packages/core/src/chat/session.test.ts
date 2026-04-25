import { describe, expect, it, vi } from 'vitest';
import { getContextUsage } from '../settings/context-usage';
import { createChatSessionCore } from './session';
import type { ChatSessionState } from './types';

function latestState(states: ChatSessionState[]): ChatSessionState {
  return states[states.length - 1];
}

const stripTs = (msgs: { role: string; content: string; timestamp?: number }[]) =>
  msgs.map(({ role, content }) => ({ role, content }));

describe('chatSessionCore', () => {
  it('submits prompt and streams assistant response', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: async (_messages, onDelta) => {
        onDelta('Hel');
        onDelta('lo');
        return { text: 'Hello' };
      }
    });

    const states: ChatSessionState[] = [];
    session.subscribe({
      onStateChange: (state) => states.push(state)
    });

    await session.submitPrompt('  Hi  ');

    expect(stripTs(latestState(states).conversation)).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' }
    ]);
    expect(latestState(states).status).toBe('');
    expect(latestState(states).isSending).toBe(false);
  });

  it('edits a user message and truncates later history before regenerating', async () => {
    const streamChat = vi
      .fn()
      .mockResolvedValueOnce({ text: 'Answer 1' })
      .mockResolvedValueOnce({ text: 'Answer 2' })
      .mockResolvedValueOnce({ text: 'Edited answer' });

    const session = createChatSessionCore({ streamChat, summarizeMessages: async () => 'unused' });

    await session.submitPrompt('first');
    await session.submitPrompt('second');
    await session.editUserMessage(0, 'first edited');

    expect(stripTs(session.getState().conversation)).toEqual([
      { role: 'user', content: 'first edited' },
      { role: 'assistant', content: 'Edited answer' }
    ]);
  });

  it('stops an in-flight response and reports stopped status', async () => {
    let rejectPending: ((reason?: unknown) => void) | null = null;

    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: (_messages, _onDelta, options) =>
        new Promise<{ text: string }>((_resolve, reject) => {
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

  it('sets durationMs on the assistant message after a completed stream', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: async (_messages, onDelta) => {
        onDelta('Hi');
        return { text: 'Hi' };
      }
    });

    await session.submitPrompt('Hello');

    const { conversation } = session.getState();
    const assistant = conversation.find((m) => m.role === 'assistant');
    expect(assistant).toBeDefined();
    expect(typeof assistant!.durationMs).toBe('number');
    expect(assistant!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not set durationMs when response is stopped', async () => {
    let rejectPending: ((reason?: unknown) => void) | null = null;

    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: (_messages, _onDelta, options) =>
        new Promise<{ text: string }>((_resolve, reject) => {
          rejectPending = reject;
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    });

    const pending = session.submitPrompt('long request');
    await Promise.resolve();

    await session.stopResponse();
    rejectPending?.(new DOMException('aborted', 'AbortError'));
    await pending;

    const { conversation } = session.getState();
    // Stopped with no content → assistant message is removed entirely
    const assistant = conversation.find((m) => m.role === 'assistant');
    expect(assistant).toBeUndefined();
  });

  it('stores token usage on the assistant message when transport returns it', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: async (_messages, onDelta) => {
        onDelta('Answer');
        return { text: 'Answer', usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
      }
    });

    await session.submitPrompt('Question');

    const { conversation } = session.getState();
    const assistant = conversation.find((m) => m.role === 'assistant');
    expect(assistant?.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
  });

  it('leaves usage undefined on the assistant message when transport does not return it', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: async (_messages, onDelta) => {
        onDelta('Answer');
        return { text: 'Answer' };
      }
    });

    await session.submitPrompt('Question');

    const { conversation } = session.getState();
    const assistant = conversation.find((m) => m.role === 'assistant');
    expect(assistant?.usage).toBeUndefined();
  });

  it('does not set usage when response is stopped', async () => {
    let rejectPending: ((reason?: unknown) => void) | null = null;

    const session = createChatSessionCore({
      summarizeMessages: async () => 'unused',
      streamChat: (_messages, onDelta, options) =>
        new Promise<{ text: string }>((_resolve, reject) => {
          rejectPending = reject;
          // emit some content so the assistant message is kept
          setTimeout(() => onDelta('partial'), 0);
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    });

    const pending = session.submitPrompt('long request');
    await new Promise((r) => setTimeout(r, 10)); // let onDelta fire

    await session.stopResponse();
    rejectPending?.(new DOMException('aborted', 'AbortError'));
    await pending;

    const { conversation } = session.getState();
    const assistant = conversation.find((m) => m.role === 'assistant');
    // partial content kept, but usage must not be set
    expect(assistant?.usage).toBeUndefined();
  });

  it('loads a conversation without calling the transport', () => {
    const streamChat = vi.fn();
    const session = createChatSessionCore({ streamChat, summarizeMessages: async () => 'unused' });

    const states: ChatSessionState[] = [];
    session.subscribe({ onStateChange: (s) => states.push(s) });

    session.loadConversation([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' }
    ]);

    expect(latestState(states).conversation).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' }
    ]);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('compacts older context without rewriting visible history', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'Model summary',
      streamChat: async () => ({ text: 'unused' })
    });
    const conversation = [
      { role: 'user' as const, content: 'Message 1' },
      { role: 'assistant' as const, content: 'Reply 1' },
      { role: 'user' as const, content: 'Message 2' },
      { role: 'assistant' as const, content: 'Reply 2' }
    ];

    session.loadConversation(conversation);

    const didCompact = await session.compactContext({
      maxMessages: 2,
      maxCharacters: 500
    });

    expect(didCompact).toBe(true);
    expect(stripTs(session.getState().conversation)).toEqual(conversation);
    expect(session.getState().compactedContext).toMatchObject({
      sourceMessageCount: 2,
      summary: 'Model summary'
    });
  });

  it('proactively compacts older context even when the current request fits', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'Model summary',
      streamChat: async () => ({ text: 'unused' })
    });

    session.loadConversation([
      { role: 'user', content: 'Message 1 '.repeat(20) },
      { role: 'assistant', content: 'Reply 1 '.repeat(20) },
      { role: 'user', content: 'Message 2 '.repeat(20) },
      { role: 'assistant', content: 'Reply 2 '.repeat(20) },
      { role: 'user', content: 'Message 3 '.repeat(20) },
      { role: 'assistant', content: 'Reply 3 '.repeat(20) }
    ]);

    const didCompact = await session.compactContext({
      maxMessages: 10,
      maxCharacters: 24000
    });

    expect(didCompact).toBe(true);
    expect(session.getState().compactedContext).toMatchObject({
      sourceMessageCount: 4,
      summary: 'Model summary'
    });
  });

  it('reduces composed usage after a manual summarize', async () => {
    const session = createChatSessionCore({
      summarizeMessages: async () => 'Model summary',
      streamChat: async () => ({ text: 'unused' })
    });
    const settings = {
      provider: 'openai' as const,
      apiKey: 'key',
      baseUrl: 'https://example.com/v1',
      model: 'test-model',
      systemPrompt: 'System prompt',
      contextMaxMessages: 10,
      contextMaxCharacters: 24000,
      enableSessionSaving: false
    };

    session.loadConversation([
      { role: 'user', content: 'Message 1 '.repeat(20) },
      { role: 'assistant', content: 'Reply 1 '.repeat(20) },
      { role: 'user', content: 'Message 2 '.repeat(20) },
      { role: 'assistant', content: 'Reply 2 '.repeat(20) },
      { role: 'user', content: 'Message 3 '.repeat(20) },
      { role: 'assistant', content: 'Reply 3 '.repeat(20) },
      { role: 'user', content: 'Message 4 '.repeat(20) },
      { role: 'assistant', content: 'Reply 4 '.repeat(20) }
    ]);

    const before = getContextUsage(settings, session.getState().conversation, session.getState().compactedContext);
    const didCompact = await session.compactContext({
      maxMessages: settings.contextMaxMessages,
      maxCharacters: settings.contextMaxCharacters
    });
    const after = getContextUsage(settings, session.getState().conversation, session.getState().compactedContext);

    expect(didCompact).toBe(true);
    expect(after.usedMessages).toBeLessThan(before.usedMessages);
    expect(after.percent).toBeLessThan(before.percent);
  });

  it('uses the transport summarizer for manual compaction', async () => {
    const summarizeMessages = vi.fn().mockResolvedValue('Model generated summary');
    const session = createChatSessionCore({
      streamChat: async () => ({ text: 'unused' }),
      summarizeMessages,
    } as Parameters<typeof createChatSessionCore>[0]);

    session.loadConversation([
      { role: 'user', content: 'Message 1 '.repeat(20) },
      { role: 'assistant', content: 'Reply 1 '.repeat(20) },
      { role: 'user', content: 'Message 2 '.repeat(20) },
      { role: 'assistant', content: 'Reply 2 '.repeat(20) },
      { role: 'user', content: 'Message 3 '.repeat(20) },
      { role: 'assistant', content: 'Reply 3 '.repeat(20) }
    ]);

    const didCompact = await session.compactContext({
      maxMessages: 10,
      maxCharacters: 24000
    });

    expect(didCompact).toBe(true);
    expect(summarizeMessages).toHaveBeenCalledTimes(1);
    expect(session.getState().compactedContext).toMatchObject({
      summary: 'Model generated summary'
    });
  });

  it('passes compacted context to the transport for future requests', async () => {
    const streamChat = vi.fn().mockResolvedValue({ text: 'Fresh answer' });
    const session = createChatSessionCore({ streamChat, summarizeMessages: async () => 'Model summary' });

    session.loadConversation([
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Reply 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Reply 2' }
    ]);
    await session.compactContext({ maxMessages: 2, maxCharacters: 500 });

    await session.submitPrompt('Next question');

    const call = vi.mocked(streamChat).mock.calls[0];
    expect(call?.[2]).toMatchObject({
      compactedContext: {
        sourceMessageCount: 2,
        summary: 'Model summary'
      }
    });
  });
});
