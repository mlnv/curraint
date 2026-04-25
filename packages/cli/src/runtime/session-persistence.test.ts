import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistSessionIfEnabled } from './session-persistence';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    persistConversation: vi.fn(),
  };
});

import { persistConversation } from '@curraint/core';

describe('persistSessionIfEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when session saving is disabled', () => {
    const result = persistSessionIfEnabled({
      enableSessionSaving: false,
      conversation: [{ role: 'user', content: 'Hello' }],
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 5000,
    });

    expect(result).toEqual({
      currentSessionId: null,
      currentSessionCreatedAt: 0,
    });
    expect(persistConversation).not.toHaveBeenCalled();
  });

  it('forwards persistence arguments to core and returns its result', () => {
    const now = () => 5000;
    const compactedContext = {
      summary: 'Earlier discussion summary',
      sourceMessageCount: 4,
      sourceCharacterCount: 1200,
    };
    const persistedState = {
      currentSessionId: 'generated-session-id',
      currentSessionCreatedAt: 5000,
    };
    vi.mocked(persistConversation).mockReturnValue(persistedState);

    const result = persistSessionIfEnabled({
      enableSessionSaving: true,
      conversation: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'assistant', content: 'Proactive hello' },
      ],
      compactedContext,
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now,
    });

    expect(persistConversation).toHaveBeenCalledWith({
      conversation: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'assistant', content: 'Proactive hello' },
      ],
      compactedContext,
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now,
    });
    expect(result).toEqual(persistedState);
  });

  it('persists sessions without compacted context using the canonical absent value', () => {
    const persistedState = {
      currentSessionId: 'new-session-id',
      currentSessionCreatedAt: 9000,
    };
    vi.mocked(persistConversation).mockReturnValue(persistedState);

    const result = persistSessionIfEnabled({
      enableSessionSaving: true,
      conversation: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi again' },
      ],
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 9000,
    });

    expect(persistConversation).toHaveBeenCalledWith({
      conversation: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi again' },
      ],
      compactedContext: undefined,
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: expect.any(Function),
    });
    expect(result).toEqual(persistedState);
  });
});