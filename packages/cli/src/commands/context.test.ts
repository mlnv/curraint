import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runContext } from './context';
import type { CommandContext } from './types';

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  const compactContext = vi.fn().mockReturnValue(true);
  const session = {
    getState: vi.fn().mockReturnValue({
      conversation: [],
      compactedContext: null,
      status: '',
      isSending: false,
      isStopping: false
    }),
    compactContext
  };

  return {
    rl: { question: vi.fn() } as unknown as CommandContext['rl'],
    getSettings: () => ({
      contextMaxMessages: 40,
      contextMaxCharacters: 24000
    } as ReturnType<CommandContext['getSettings']>),
    setSettings: vi.fn(),
    getSession: () => session as unknown as ReturnType<CommandContext['getSession']>,
    rebuildSession: vi.fn(),
    sessionUI: { printContextUsage: vi.fn() } as unknown as CommandContext['sessionUI'],
    getCurrentSessionId: () => null,
    setCurrentSessionId: vi.fn(),
    getSettingsFilePath: () => '/settings.json',
    ...overrides
  };
}

describe('runContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prints current context usage when no action is provided', () => {
    const ctx = makeCtx();

    expect(runContext(ctx, '/context')).toBe('continue');
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(ctx.getSession(), ctx.getSettings());
  });

  it('summarizes older context when requested', () => {
    const compactContext = vi.fn().mockReturnValue(true);
    const session = {
      getState: vi.fn().mockReturnValue({
        conversation: [],
        compactedContext: null,
        status: '',
        isSending: false,
        isStopping: false
      }),
      compactContext
    };
    const ctx = makeCtx({
      getSession: () => session as unknown as ReturnType<CommandContext['getSession']>
    });

    expect(runContext(ctx, '/context summarize')).toBe('continue');
    expect(compactContext).toHaveBeenCalledWith({
      maxMessages: 40,
      maxCharacters: 24000
    });
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(session, ctx.getSettings());
  });
});