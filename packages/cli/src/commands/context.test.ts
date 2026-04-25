import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runContext } from './context';
import type { CommandContext } from './types';

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  const compactContext = vi.fn().mockResolvedValue(true);
  const session = {
    getState: vi.fn().mockReturnValue({
      conversation: [],
      compactedContext: null,
      status: '',
      isSending: false,
      isStopping: false,
      isCompactingContext: false
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

  it('prints current context usage when no action is provided', async () => {
    const ctx = makeCtx();

    await expect(runContext(ctx, '/context')).resolves.toBe('continue');
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(ctx.getSession(), ctx.getSettings());
  });

  it('summarizes older context when requested', async () => {
    const ctx = makeCtx();
    const session = ctx.getSession();

    await expect(runContext(ctx, '/context summarize')).resolves.toBe('continue');
    expect(session.compactContext).toHaveBeenCalledWith({
      maxMessages: 40,
      maxCharacters: 24000
    });
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(session, ctx.getSettings());
  });

  it('prints an informative message when there is nothing to compact', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const compactContext = vi.fn().mockResolvedValue(false);
    const session = {
      getState: vi.fn().mockReturnValue({
        conversation: [],
        compactedContext: null,
        status: '',
        isSending: false,
        isStopping: false,
        isCompactingContext: false
      }),
      compactContext
    };
    const ctx = makeCtx({
      getSession: () => session as ReturnType<CommandContext['getSession']>
    });

    await expect(runContext(ctx, '/context summarize')).resolves.toBe('continue');

    expect(outputWrite).toHaveBeenCalledWith(
      'Nothing to summarize yet. There is not enough older context to compact.\n'
    );
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(session, ctx.getSettings());
  });

  it('prints a readable error when compaction fails', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const error = new Error('Summary provider failed');
    const compactContext = vi.fn().mockRejectedValue(error);
    const session = {
      getState: vi.fn().mockReturnValue({
        conversation: [],
        compactedContext: null,
        status: '',
        isSending: false,
        isStopping: false,
        isCompactingContext: false
      }),
      compactContext
    };
    const ctx = makeCtx({
      getSession: () => session as ReturnType<CommandContext['getSession']>
    });

    await expect(runContext(ctx, '/context summarize')).resolves.toBe('continue');

    expect(outputWrite).toHaveBeenCalledWith(
      expect.stringContaining('Failed to summarize context:')
    );
    expect(outputWrite).toHaveBeenCalledWith(expect.stringContaining('Summary provider failed'));
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(session, ctx.getSettings());
  });

  it('prints usage and context details for unknown subcommands', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ctx = makeCtx();

    await expect(runContext(ctx, '/context foo')).resolves.toBe('continue');

    expect(outputWrite).toHaveBeenCalledWith('Usage: /context or /context summarize\n');
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(ctx.getSession(), ctx.getSettings());
  });

  it('reports when context summarization is already in progress', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const compactContext = vi.fn();
    const session = {
      getState: vi.fn().mockReturnValue({
        conversation: [],
        compactedContext: null,
        status: '',
        isSending: false,
        isStopping: false,
        isCompactingContext: true
      }),
      compactContext
    };
    const ctx = makeCtx({
      getSession: () => session as ReturnType<CommandContext['getSession']>
    });

    await expect(runContext(ctx, '/context summarize')).resolves.toBe('continue');

    expect(compactContext).not.toHaveBeenCalled();
    expect(outputWrite).toHaveBeenCalledWith(
      'Context summarization is already in progress. Please wait for it to finish.\n'
    );
    expect(ctx.sessionUI.printContextUsage).toHaveBeenCalledWith(session, ctx.getSettings());
  });
});