import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapCliSettings } from './bootstrap';

vi.mock('../settings', () => ({
  loadSettings: vi.fn(),
}));

vi.mock('../setup', () => ({
  isFirstRun: vi.fn(),
  runFirstRunSetup: vi.fn(),
  askForApiKeyIfNeeded: vi.fn(),
}));

import { loadSettings } from '../settings';
import { askForApiKeyIfNeeded, isFirstRun, runFirstRunSetup } from '../setup';

describe('bootstrapCliSettings', () => {
  const rl = { question: vi.fn() } as unknown as Parameters<typeof bootstrapCliSettings>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exitCode 1 when API key bootstrap fails', async () => {
    const settings = { provider: 'openai', model: 'gpt-4o' };
    vi.mocked(loadSettings).mockReturnValue(settings as never);
    vi.mocked(isFirstRun).mockReturnValue(false);
    vi.mocked(askForApiKeyIfNeeded).mockResolvedValue(null);

    const result = await bootstrapCliSettings(rl);

    expect(result).toEqual({ exitCode: 1, settings: null });
    expect(runFirstRunSetup).not.toHaveBeenCalled();
    expect(askForApiKeyIfNeeded).toHaveBeenCalledWith(rl, settings, false);
  });

  it('runs first-run setup before API key bootstrap when settings file is empty', async () => {
    const loadedSettings = { provider: 'openai', model: 'gpt-4o' };
    const setupSettings = { provider: 'custom', model: 'local-model' };
    const finalSettings = { provider: 'custom', model: 'local-model', apiKey: 'secret' };

    vi.mocked(loadSettings).mockReturnValue(loadedSettings as never);
    vi.mocked(isFirstRun).mockReturnValue(true);
    vi.mocked(runFirstRunSetup).mockResolvedValue(setupSettings as never);
    vi.mocked(askForApiKeyIfNeeded).mockResolvedValue(finalSettings as never);

    const result = await bootstrapCliSettings(rl);

    expect(runFirstRunSetup).toHaveBeenCalledWith(rl, loadedSettings);
    expect(askForApiKeyIfNeeded).toHaveBeenCalledWith(rl, setupSettings, true);
    expect(result).toEqual({ exitCode: 0, settings: finalSettings });
  });

  it('skips first-run setup when settings already exist', async () => {
    const settings = { provider: 'openai', model: 'gpt-4o' };

    vi.mocked(loadSettings).mockReturnValue(settings as never);
    vi.mocked(isFirstRun).mockReturnValue(false);
    vi.mocked(askForApiKeyIfNeeded).mockResolvedValue(settings as never);

    const result = await bootstrapCliSettings(rl);

    expect(runFirstRunSetup).not.toHaveBeenCalled();
    expect(askForApiKeyIfNeeded).toHaveBeenCalledWith(rl, settings, false);
    expect(result).toEqual({ exitCode: 0, settings });
  });
});