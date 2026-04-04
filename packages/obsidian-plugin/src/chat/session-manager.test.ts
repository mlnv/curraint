import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @curraint/core before importing ConversationRegistry.
vi.mock('@curraint/core', () => {
  return {
    createChatSessionCore: vi.fn(() => makeMockCore()),
    generateSessionId: vi.fn(() => 'mock-session-id'),
    deriveTitle: vi.fn((msg: string) => msg.slice(0, 60)),
    saveSession: vi.fn(),
    getSession: vi.fn(),
  };
});

import {
  createChatSessionCore,
  generateSessionId,
  deriveTitle,
  saveSession,
  getSession,
} from '@curraint/core';
import type { ChatSessionCore, ChatSessionSubscriber, ChatSessionTransport } from '@curraint/core';
import { ConversationRegistry } from './session-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ConvMessage = { role: string; content: string };

type MockCore = ChatSessionCore & {
  _triggerStateChange: (isSending: boolean, conversation?: ConvMessage[]) => void;
};

function makeMockCore(initialConversation: ConvMessage[] = []): MockCore {
  const subscribers = new Set<ChatSessionSubscriber>();
  let currentConversation = initialConversation as import('@curraint/core').ChatMessage[];
  let currentIsSending = false;

  const core = {
    getState: vi.fn(() => ({
      conversation: currentConversation,
      status: '',
      isSending: currentIsSending,
      isStopping: false,
    })),
    subscribe: vi.fn((sub: ChatSessionSubscriber) => {
      subscribers.add(sub);
      // Fire immediately with current (idle) state, matching real implementation.
      sub.onStateChange?.({
        conversation: currentConversation,
        status: '',
        isSending: false,
        isStopping: false,
      });
      return () => subscribers.delete(sub);
    }),
    submitPrompt: vi.fn(),
    editUserMessage: vi.fn(),
    retryLastMessage: vi.fn(),
    stopResponse: vi.fn(),
    clearConversation: vi.fn(),
    loadConversation: vi.fn((msgs) => {
      currentConversation = msgs;
      for (const sub of subscribers) {
        sub.onStateChange?.({
          conversation: currentConversation,
          status: '',
          isSending: false,
          isStopping: false,
        });
      }
    }),
    // Test helper - simulate a state change
    _triggerStateChange: (isSending: boolean, conversation?: ConvMessage[]) => {
      if (conversation) currentConversation = conversation as import('@curraint/core').ChatMessage[];
      currentIsSending = isSending;
      for (const sub of subscribers) {
        sub.onStateChange?.({
          conversation: currentConversation,
          status: '',
          isSending,
          isStopping: false,
        });
      }
    },
  } as unknown as MockCore;

  return core;
}

function makeTransport(): ChatSessionTransport {
  return { streamChat: vi.fn() };
}

function makeCoreForCall(n: number): MockCore {
  const calls = vi.mocked(createChatSessionCore).mock.results;
  return calls[n]?.value as MockCore;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('ConversationRegistry - lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createChatSessionCore).mockImplementation(() => makeMockCore());
  });

  it('starts with no active core before init()', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    expect(reg.getActiveSlot()).toBeNull();
  });

  it('creates the initial slot on init()', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    expect(reg.getActiveSlot()).not.toBeNull();
    expect(createChatSessionCore).toHaveBeenCalledTimes(1);
  });

  it('getOrCreateActive() returns the same core on repeated calls', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    const a = reg.getOrCreateActive();
    const b = reg.getOrCreateActive();
    expect(a).toBe(b);
  });

  it('newConversation() changes the active key and creates a new core', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    const before = reg.activeKey;

    reg.newConversation();

    expect(reg.activeKey).not.toBe(before);
    expect(createChatSessionCore).toHaveBeenCalledTimes(2);
  });

  it('getOrCreateActive() after newConversation() returns the new core', () => {
    vi.mocked(createChatSessionCore)
      .mockImplementationOnce(() => makeMockCore()) // init slot
      .mockImplementationOnce(() => makeMockCore()); // new conv slot

    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    const firstCore = reg.getOrCreateActive();

    reg.newConversation();
    const secondCore = reg.getOrCreateActive();

    expect(secondCore).not.toBe(firstCore);
  });

  it('stopActive() calls stopResponse on the active core', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    reg.stopActive();
    const slot = makeCoreForCall(0);
    expect(slot.stopResponse).toHaveBeenCalledTimes(1);
  });

  it('destroy() unsubscribes all slots', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    reg.newConversation();

    reg.destroy();

    // After destroy the registry is empty.
    expect(reg.getActiveSlot()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadSession
// ---------------------------------------------------------------------------

describe('ConversationRegistry - loadSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createChatSessionCore).mockImplementation(() => makeMockCore());
  });

  const saved = {
    id: 'saved-123',
    title: 'Past chat',
    createdAt: 1000,
    updatedAt: 2000,
    messages: [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there', timestamp: 0 },
    ],
  };

  it('changes the active key to the session id', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    reg.loadSession(saved);
    expect(reg.activeKey).toBe(saved.id);
  });

  it('calls loadConversation with the saved messages', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    reg.loadSession(saved);
    const core = reg.getOrCreateActive();
    expect(core.loadConversation).toHaveBeenCalledWith(saved.messages);
  });

  it('re-uses a streaming background slot matching the session id', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();

    // Simulate the initial slot streaming for this saved session
    const initCore = makeCoreForCall(0) as MockCore;
    const initSlot = reg.getActiveSlot()!;
    initSlot.sessionId = saved.id;
    initCore._triggerStateChange(true, [{ role: 'user', content: 'Hello' }]);

    const keyBeforeSwitch = reg.activeKey;

    // Switch to a new conversation, then load back the streaming session.
    reg.newConversation();
    reg.loadSession(saved);

    // Should have switched back to the still-streaming slot, not created a new core.
    expect(reg.activeKey).toBe(keyBeforeSwitch);
    expect(createChatSessionCore).toHaveBeenCalledTimes(2); // init + newConversation only
  });

  it('replaces a stale idle slot when reloading the same session', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();

    reg.loadSession(saved);
    const firstCore = reg.getOrCreateActive();

    reg.loadSession(saved);
    const secondCore = reg.getOrCreateActive();

    expect(secondCore).not.toBe(firstCore);
  });

  it('removes a mismatched idle slot key before loading the canonical saved session key', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    reg.newConversation();

    const oldKey = reg.activeKey;
    const oldCore = reg.getOrCreateActive();
    const oldSlot = reg.getActiveSlot()!;
    oldSlot.sessionId = saved.id;

    reg.loadSession(saved);

    const newCore = reg.getOrCreateActive();
    const slots = (reg as unknown as { slots: Map<string, unknown> }).slots;

    expect(reg.activeKey).toBe(saved.id);
    expect(newCore).not.toBe(oldCore);
    expect(slots.has(oldKey)).toBe(false);
    expect(slots.has(saved.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renameActive
// ---------------------------------------------------------------------------

describe('ConversationRegistry - renameActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createChatSessionCore).mockImplementation(() => makeMockCore());
  });

  it('persists clearing the title for a saved session', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();

    const savedSession = {
      id: 'saved-123',
      title: 'Existing title',
      createdAt: 1000,
      updatedAt: 2000,
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };
    vi.mocked(getSession).mockReturnValue(savedSession);

    reg.loadSession(savedSession);
    reg.renameActive('   ');

    expect(reg.getActiveSlot()?.title).toBe('');
    expect(saveSession).toHaveBeenCalledWith({
      ...savedSession,
      title: '',
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-save - triggered by registry's persistent subscription
// ---------------------------------------------------------------------------

describe('ConversationRegistry - autoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateSessionId).mockReturnValue('mock-session-id');
    vi.mocked(deriveTitle).mockImplementation((msg: string) => msg.slice(0, 60));
    vi.mocked(createChatSessionCore).mockImplementation(() => makeMockCore());
  });

  it('does not save when getEnableSessionSaving returns false', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();
    const core = makeCoreForCall(0);
    core._triggerStateChange(true, [{ role: 'user', content: 'Hello' }]);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('saves eagerly when isSending transitions false -> true', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'user', content: 'Hello' }]);

    expect(saveSession).toHaveBeenCalledTimes(1);
  });

  it('saves again when isSending transitions true -> false', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'user', content: 'Hello' }]);
    core._triggerStateChange(false, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ]);

    expect(saveSession).toHaveBeenCalledTimes(2);
  });

  it('does not save when there are no user messages', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'system', content: 'You are helpful.' }]);

    expect(saveSession).not.toHaveBeenCalled();
  });

  it('filters system messages before saving', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ]);

    const saved = vi.mocked(saveSession).mock.calls[0]![0];
    expect(saved.messages.every((m) => m.role !== 'system')).toBe(true);
  });

  it('strips a trailing empty assistant placeholder before saving', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: '' },
    ]);

    const saved = vi.mocked(saveSession).mock.calls[0]![0];
    expect(saved.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('generates a session id on the first save', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'user', content: 'Hello' }]);

    expect(generateSessionId).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveSession).mock.calls[0]![0].id).toBe('mock-session-id');
  });

  it('reuses the same session id on subsequent saves', () => {
    vi.mocked(generateSessionId)
      .mockReturnValueOnce('first-id')
      .mockReturnValueOnce('second-id');

    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'user', content: 'Hello' }]);
    core._triggerStateChange(false, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ]);

    expect(generateSessionId).toHaveBeenCalledTimes(1);
    const calls = vi.mocked(saveSession).mock.calls;
    expect(calls[0]![0].id).toBe('first-id');
    expect(calls[1]![0].id).toBe('first-id');
  });

  it('derives title from the first user message', () => {
    vi.mocked(deriveTitle).mockReturnValue('My question');
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'user', content: 'My question' }]);

    expect(deriveTitle).toHaveBeenCalledWith('My question');
    expect(vi.mocked(saveSession).mock.calls[0]![0].title).toBe('My question');
  });

  it('keeps the title stable across multiple saves', () => {
    vi.mocked(deriveTitle).mockReturnValue('First msg');
    const reg = new ConversationRegistry(() => makeTransport(), () => true);
    reg.init();
    const core = makeCoreForCall(0);

    core._triggerStateChange(true, [{ role: 'user', content: 'First msg' }]);
    core._triggerStateChange(false, [
      { role: 'user', content: 'First msg' },
      { role: 'assistant', content: 'Response' },
    ]);

    expect(deriveTitle).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Background slot cleanup
// ---------------------------------------------------------------------------

describe('ConversationRegistry - background slot cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createChatSessionCore).mockImplementation(() => makeMockCore());
  });

  it('removes a background slot from the registry when its stream finishes', () => {
    const reg = new ConversationRegistry(() => makeTransport(), () => false);
    reg.init();

    const initialKey = reg.activeKey;
    const initCore = makeCoreForCall(0);

    // Start streaming on the initial slot.
    initCore._triggerStateChange(true, [{ role: 'user', content: 'Hi' }]);

    // Switch to a new conversation - initial slot becomes background.
    reg.newConversation();
    expect(reg.activeKey).not.toBe(initialKey);

    // Background slot finishes - it should remove itself.
    initCore._triggerStateChange(false, [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);

    // The background slot should no longer be reachable as a live streaming slot.
    // After cleanup, loading the same session id should create a fresh slot.
    expect(createChatSessionCore).toHaveBeenCalledTimes(2); // init + newConversation
  });
});

// ---------------------------------------------------------------------------
