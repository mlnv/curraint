import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@curraint/core';
import { persistSessionIfEnabled } from './session-persistence';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    deriveTitle: vi.fn(),
    generateSessionId: vi.fn(),
    persistConversation: vi.fn(),
    saveSession: vi.fn(),
  };
});

import {
  deriveTitle,
  generateSessionId,
  persistConversation,
  saveSession,
} from '@curraint/core';

describe('persistSessionIfEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateSessionId).mockReturnValue('generated-session-id');
    vi.mocked(deriveTitle).mockImplementation((text: string) => text.slice(0, 60));
    vi.mocked(persistConversation).mockImplementation(({ conversation, currentSessionId, currentSessionCreatedAt, now }) => {
      const messages = conversation.filter((message) => message.role !== 'system');
      if (messages.length === 0) {
        return { currentSessionId, currentSessionCreatedAt };
      }

      const timestamp = now ? now() : 5000;
      const nextSessionId = currentSessionId ?? generateSessionId();
      const nextCreatedAt = currentSessionId ? currentSessionCreatedAt : timestamp;
      const firstUserMessage = messages.find((message) => message.role === 'user')?.content ?? '';

      saveSession({
        id: nextSessionId,
        title: deriveTitle(firstUserMessage),
        createdAt: nextCreatedAt,
        updatedAt: timestamp,
        messages,
      });

      return {
        currentSessionId: nextSessionId,
        currentSessionCreatedAt: nextCreatedAt,
      };
    });
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
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('does nothing when there are no non-system messages', () => {
    const result = persistSessionIfEnabled({
      enableSessionSaving: true,
      conversation: [{ role: 'system', content: 'You are helpful.' }],
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 5000,
    });

    expect(result).toEqual({
      currentSessionId: null,
      currentSessionCreatedAt: 0,
    });
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('creates session metadata and saves filtered messages on first save', () => {
    const conversation: ChatMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello there' },
      { role: 'assistant', content: 'Hi' },
    ];

    const result = persistSessionIfEnabled({
      enableSessionSaving: true,
      conversation,
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 5000,
    });

    expect(result).toEqual({
      currentSessionId: 'generated-session-id',
      currentSessionCreatedAt: 5000,
    });
    expect(deriveTitle).toHaveBeenCalledWith('Hello there');
    expect(saveSession).toHaveBeenCalledWith({
      id: 'generated-session-id',
      title: 'Hello there',
      createdAt: 5000,
      updatedAt: 5000,
      messages: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi' },
      ],
    });
  });

  it('reuses existing session metadata on later saves', () => {
    const result = persistSessionIfEnabled({
      enableSessionSaving: true,
      conversation: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi again' },
      ],
      currentSessionId: 'existing-session-id',
      currentSessionCreatedAt: 3000,
      now: () => 8000,
    });

    expect(result).toEqual({
      currentSessionId: 'existing-session-id',
      currentSessionCreatedAt: 3000,
    });
    expect(generateSessionId).not.toHaveBeenCalled();
    expect(saveSession).toHaveBeenCalledWith({
      id: 'existing-session-id',
      title: 'Hello there',
      createdAt: 3000,
      updatedAt: 8000,
      messages: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi again' },
      ],
    });
  });

  it('creates a session for assistant-only conversations', () => {
    const result = persistSessionIfEnabled({
      enableSessionSaving: true,
      conversation: [{ role: 'assistant', content: 'Proactive hello' }],
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 5000,
    });

    expect(result).toEqual({
      currentSessionId: 'generated-session-id',
      currentSessionCreatedAt: 5000,
    });
    expect(deriveTitle).toHaveBeenCalledWith('');
    expect(saveSession).toHaveBeenCalledWith({
      id: 'generated-session-id',
      title: '',
      createdAt: 5000,
      updatedAt: 5000,
      messages: [
        { role: 'assistant', content: 'Proactive hello' },
      ],
    });
  });
});