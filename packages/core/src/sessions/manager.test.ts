import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSession,
  deriveTitle,
  generateSessionId,
  getSession,
  listSessions,
  persistConversation,
  saveSession
} from './manager';
import type { SavedSession } from './types';

vi.mock('./storage', () => ({
  listSessionFiles: vi.fn(),
  readSession: vi.fn(),
  writeSession: vi.fn(),
  deleteSessionFile: vi.fn()
}));

import {
  deleteSessionFile,
  listSessionFiles,
  readSession,
  writeSession
} from './storage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateSessionId', () => {
  it('returns a string matching the timestamp-hex pattern', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^\d+-[0-9a-f]{4}$/);
  });

  it('generates distinct ids across multiple calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateSessionId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('deriveTitle', () => {
  it('returns the full string when it is ≤60 characters', () => {
    expect(deriveTitle('hello')).toBe('hello');
  });

  it('truncates to the first 60 characters when longer', () => {
    const long = 'a'.repeat(100);
    expect(deriveTitle(long)).toHaveLength(60);
    expect(deriveTitle(long)).toBe('a'.repeat(60));
  });

  it('trims surrounding whitespace', () => {
    expect(deriveTitle('  hello  ')).toBe('hello');
  });

  it('trims before checking the 60-character limit', () => {
    const padded = '  ' + 'b'.repeat(60) + '  ';
    expect(deriveTitle(padded)).toBe('b'.repeat(60));
  });

  it('handles an empty string', () => {
    expect(deriveTitle('')).toBe('');
  });
});

describe('listSessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns sessions sorted by updatedAt descending', () => {
    vi.mocked(listSessionFiles).mockReturnValue(['id1', 'id2']);
    vi.mocked(readSession).mockImplementation((id) => {
      if (id === 'id1') {
        return { id: 'id1', title: 'First', createdAt: 1000, updatedAt: 1000, messages: [] };
      }
      if (id === 'id2') {
        return { id: 'id2', title: 'Second', createdAt: 2000, updatedAt: 2000, messages: [] };
      }
      return null;
    });

    const result = listSessions();
    expect(result[0]?.id).toBe('id2');
    expect(result[1]?.id).toBe('id1');
  });

  it('returns an empty array when no session files exist', () => {
    vi.mocked(listSessionFiles).mockReturnValue([]);
    expect(listSessions()).toEqual([]);
  });

  it('skips entries that cannot be read', () => {
    vi.mocked(listSessionFiles).mockReturnValue(['good', 'corrupt']);
    vi.mocked(readSession).mockImplementation((id) => {
      if (id === 'good') {
        return { id: 'good', title: 'Good', createdAt: 1000, updatedAt: 1000, messages: [] };
      }
      return null;
    });

    const result = listSessions();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('good');
  });

  it('includes messageCount in each summary', () => {
    vi.mocked(listSessionFiles).mockReturnValue(['s1']);
    vi.mocked(readSession).mockReturnValue({
      id: 's1',
      title: 'Chat',
      createdAt: 1000,
      updatedAt: 1000,
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' }
      ]
    });

    const [summary] = listSessions();
    expect(summary?.messageCount).toBe(2);
  });
});

describe('getSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to readSession and returns the result', () => {
    const session: SavedSession = {
      id: 'x',
      title: 'T',
      createdAt: 0,
      updatedAt: 0,
      messages: []
    };
    vi.mocked(readSession).mockReturnValue(session);

    expect(getSession('x')).toBe(session);
    expect(readSession).toHaveBeenCalledWith('x');
  });

  it('returns null when the session does not exist', () => {
    vi.mocked(readSession).mockReturnValue(null);
    expect(getSession('missing')).toBeNull();
  });
});

describe('saveSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to writeSession', () => {
    const session: SavedSession = {
      id: 'x',
      title: 'T',
      createdAt: 0,
      updatedAt: 0,
      messages: []
    };
    saveSession(session);
    expect(writeSession).toHaveBeenCalledWith(session);
  });
});

describe('persistConversation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new session from non-system messages', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = persistConversation({
      conversation: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi' }
      ],
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 5000
    });

    expect(result).toEqual({
      currentSessionId: '1234-0000',
      currentSessionCreatedAt: 5000
    });
    expect(writeSession).toHaveBeenCalledWith({
      id: '1234-0000',
      title: 'Hello there',
      createdAt: 5000,
      updatedAt: 5000,
      compactedContext: null,
      messages: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi' }
      ]
    });
  });

  it('keeps assistant-only conversations and derives an empty title', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2345);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = persistConversation({
      conversation: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'assistant', content: 'Proactive hello' }
      ],
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 7000
    });

    expect(result).toEqual({
      currentSessionId: '2345-0000',
      currentSessionCreatedAt: 7000
    });
    expect(writeSession).toHaveBeenCalledWith({
      id: '2345-0000',
      title: '',
      createdAt: 7000,
      updatedAt: 7000,
      compactedContext: null,
      messages: [
        { role: 'assistant', content: 'Proactive hello' }
      ]
    });
  });

  it('persists compacted context when provided', () => {
    vi.spyOn(Date, 'now').mockReturnValue(3456);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const compactedContext = {
      summary: 'Earlier discussion summary',
      sourceMessageCount: 4,
      sourceCharacterCount: 1200
    };

    persistConversation({
      conversation: [{ role: 'user', content: 'Continue' }],
      compactedContext,
      currentSessionId: null,
      currentSessionCreatedAt: 0,
      now: () => 8000
    });

    expect(writeSession).toHaveBeenCalledWith({
      id: '3456-0000',
      title: 'Continue',
      createdAt: 8000,
      updatedAt: 8000,
      compactedContext,
      messages: [{ role: 'user', content: 'Continue' }]
    });
  });

  it('returns existing metadata unchanged when no non-system messages remain', () => {
    const result = persistConversation({
      conversation: [{ role: 'system', content: 'You are helpful.' }],
      currentSessionId: 'existing-id',
      currentSessionCreatedAt: 3000,
      now: () => 9000
    });

    expect(result).toEqual({
      currentSessionId: 'existing-id',
      currentSessionCreatedAt: 3000
    });
    expect(writeSession).not.toHaveBeenCalled();
  });
});

describe('deleteSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to deleteSessionFile', () => {
    deleteSession('abc');
    expect(deleteSessionFile).toHaveBeenCalledWith('abc');
  });
});
