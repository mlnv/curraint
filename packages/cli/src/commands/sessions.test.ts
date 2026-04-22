import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runSessions } from './sessions';
import type { CommandContext } from './types';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    listSessions: vi.fn(),
    getSession: vi.fn()
  };
});

import { listSessions, getSession } from '@curraint/core';
import type { SavedSession, SessionSummary } from '@curraint/core';

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  const setCurrentSessionId = vi.fn();
  return {
    rl: { question: vi.fn().mockResolvedValue('0') } as unknown as CommandContext['rl'],
    getSettings: () => ({ enableSessionSaving: true } as ReturnType<CommandContext['getSettings']>),
    setSettings: vi.fn(),
    getSession: vi.fn().mockReturnValue({ loadConversation: vi.fn() }),
    rebuildSession: vi.fn(),
    sessionUI: { printHistory: vi.fn() } as unknown as CommandContext['sessionUI'],
    getCurrentSessionId: () => null,
    setCurrentSessionId,
    getSettingsFilePath: () => '/config/settings.json',
    ...overrides
  };
}

const SESSIONS: SessionSummary[] = [
  { id: 'id1', title: 'First chat', createdAt: 1000, updatedAt: 2000, messageCount: 4 },
  { id: 'id2', title: 'Second chat', createdAt: 3000, updatedAt: 4000, messageCount: 2 }
];

describe('runSessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('notifies user when session saving is disabled', async () => {
    const ctx = makeCtx({
      getSettings: () => ({ enableSessionSaving: false } as ReturnType<CommandContext['getSettings']>)
    });
    const result = await runSessions(ctx);
    expect(result).toBe('continue');
    expect(listSessions).not.toHaveBeenCalled();
  });

  it('notifies user when no sessions exist', async () => {
    vi.mocked(listSessions).mockReturnValue([]);
    const ctx = makeCtx();
    const result = await runSessions(ctx);
    expect(result).toBe('continue');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('cancels when user picks 0', async () => {
    vi.mocked(listSessions).mockReturnValue(SESSIONS);
    const ctx = makeCtx({
      rl: { question: vi.fn().mockResolvedValue('0') } as unknown as CommandContext['rl']
    });
    const result = await runSessions(ctx);
    expect(result).toBe('continue');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('cancels when user enters non-numeric input', async () => {
    vi.mocked(listSessions).mockReturnValue(SESSIONS);
    const ctx = makeCtx({
      rl: { question: vi.fn().mockResolvedValue('abc') } as unknown as CommandContext['rl']
    });
    const result = await runSessions(ctx);
    expect(result).toBe('continue');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('loads session and updates context when user picks a valid number', async () => {
    vi.mocked(listSessions).mockReturnValue(SESSIONS);
    const fullSession: SavedSession = {
      id: 'id1',
      title: 'First chat',
      createdAt: 1000,
      updatedAt: 2000,
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' }
      ]
    };
    vi.mocked(getSession).mockReturnValue(fullSession);

    const loadConversation = vi.fn();
    const setCurrentSessionId = vi.fn();
    const ctx = makeCtx({
      rl: { question: vi.fn().mockResolvedValue('1') } as unknown as CommandContext['rl'],
      getSession: vi.fn().mockReturnValue({ loadConversation }),
      setCurrentSessionId
    });

    const result = await runSessions(ctx);

    expect(result).toBe('continue');
    expect(getSession).toHaveBeenCalledWith('id1');
    expect(loadConversation).toHaveBeenCalledWith(fullSession.messages, null);
    expect(setCurrentSessionId).toHaveBeenCalledWith('id1', 1000);
  });

  it('reports when a session file cannot be found after listing', async () => {
    vi.mocked(listSessions).mockReturnValue(SESSIONS);
    vi.mocked(getSession).mockReturnValue(null);
    const ctx = makeCtx({
      rl: { question: vi.fn().mockResolvedValue('1') } as unknown as CommandContext['rl']
    });

    const result = await runSessions(ctx);
    expect(result).toBe('continue');
  });
});
