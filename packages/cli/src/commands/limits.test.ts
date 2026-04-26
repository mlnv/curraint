import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointSettings } from '@curraint/core';
import type { CommandContext } from './types';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    loadSettingsFromFile: vi.fn(),
    saveSettingsToFile: vi.fn(),
  };
});

import { DEFAULT_SETTINGS, loadSettingsFromFile, saveSettingsToFile } from '@curraint/core';
import { runLimits } from './limits';

const ORIGINAL_ENV = { ...process.env };

const BASE_SETTINGS: EndpointSettings = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://example.com/v1',
  model: 'test-model',
  systemPrompt: 'System prompt',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false,
};

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  const settings = { ...BASE_SETTINGS };
  return {
    rl: { question: vi.fn() } as unknown as CommandContext['rl'],
    getSettings: () => settings,
    setSettings: vi.fn(),
    getSession: () => ({
      getState: vi.fn().mockReturnValue({
        conversation: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
        ],
        compactedContext: null,
      }),
    }) as unknown as ReturnType<CommandContext['getSession']>,
    rebuildSession: vi.fn(),
    sessionUI: { printContextUsage: vi.fn() } as unknown as CommandContext['sessionUI'],
    getCurrentSessionId: () => 'session-1',
    setCurrentSessionId: vi.fn(),
    getSettingsFilePath: () => '/settings.json',
    ...overrides,
  };
}

describe('runLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env['CURRAINT_CONTEXT_MAX_MESSAGES'];
    delete process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'];
    vi.mocked(loadSettingsFromFile).mockReturnValue(BASE_SETTINGS);
    vi.mocked(saveSettingsToFile).mockImplementation((settings: EndpointSettings) => settings);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('prints the active limits when called without arguments', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ctx = makeCtx();

    await expect(runLimits(ctx, '/limits')).resolves.toBe('continue');

    expect(outputWrite).toHaveBeenCalledWith(expect.stringContaining('Message limit: 40'));
    expect(outputWrite).toHaveBeenCalledWith(expect.stringContaining('Character limit: 24000'));
  });

  it('saves a new message limit and refreshes the session transport', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ctx = makeCtx();

    await expect(runLimits(ctx, '/limits set messages 80')).resolves.toBe('continue');

    expect(saveSettingsToFile).toHaveBeenCalledWith({
      ...BASE_SETTINGS,
      contextMaxMessages: 80,
    });
    expect(ctx.rebuildSession).toHaveBeenCalledWith(
      {
        ...BASE_SETTINGS,
        contextMaxMessages: 80,
      },
      { preserveConversation: true },
    );
    expect(outputWrite).toHaveBeenCalledWith(expect.stringContaining('Saved message limit as 80.'));
  });

  it('saves a new character limit and refreshes the session transport', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ctx = makeCtx();

    await expect(runLimits(ctx, '/limits set chars 60000')).resolves.toBe('continue');

    expect(saveSettingsToFile).toHaveBeenCalledWith({
      ...BASE_SETTINGS,
      contextMaxCharacters: 60000,
    });
    expect(ctx.rebuildSession).toHaveBeenCalledWith(
      {
        ...BASE_SETTINGS,
        contextMaxCharacters: 60000,
      },
      { preserveConversation: true },
    );
    expect(outputWrite).toHaveBeenCalledWith(expect.stringContaining('Saved character limit as 60000.'));
  });

  it('resets both limits to the shared defaults', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ctx = makeCtx({
      getSettings: () => ({
        ...BASE_SETTINGS,
        contextMaxMessages: 100,
        contextMaxCharacters: 90000,
      }),
    });

    await expect(runLimits(ctx, '/limits reset')).resolves.toBe('continue');

    expect(saveSettingsToFile).toHaveBeenCalledWith({
      ...BASE_SETTINGS,
      contextMaxMessages: DEFAULT_SETTINGS.contextMaxMessages,
      contextMaxCharacters: DEFAULT_SETTINGS.contextMaxCharacters,
    });
    expect(outputWrite).toHaveBeenCalledWith(expect.stringContaining('Reset context limits to defaults.'));
  });

  it('rejects invalid integer input', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ctx = makeCtx();

    await expect(runLimits(ctx, '/limits set messages abc')).resolves.toBe('continue');

    expect(saveSettingsToFile).not.toHaveBeenCalled();
    expect(outputWrite).toHaveBeenCalledWith(
      'Invalid messages limit "abc". Enter an integer between 4 and 120.\n'
    );
  });

  it('warns when environment variables override the current session', async () => {
    const outputWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = '99';
    const ctx = makeCtx();

    await expect(runLimits(ctx, '/limits set messages 80')).resolves.toBe('continue');

    expect(outputWrite).toHaveBeenCalledWith(
      'Saved to settings file, but the current session is still overridden by environment variables.\n'
    );
  });
});