import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointSettings } from '@curraint/core';
import { isFirstRun, runFirstRunSetup } from './first-run';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    PROVIDER_OPTIONS: [
      { id: 'openai', label: 'OpenAI' },
      { id: 'custom', label: 'Custom' },
    ],
    getProviderConfig: vi.fn((provider: string) => {
      if (provider === 'custom') {
        return {
          defaultModel: 'custom-model',
          defaultBaseUrl: 'http://localhost:1234',
        };
      }
      return {
        defaultModel: 'gpt-4o',
        defaultBaseUrl: 'https://api.openai.com/v1',
      };
    }),
    loadRawSettingsFromFile: vi.fn(),
    normalizeSettings: vi.fn((settings: EndpointSettings) => settings),
  };
});

vi.mock('../ask-secret', () => ({
  askSecret: vi.fn(),
}));

import { loadRawSettingsFromFile } from '@curraint/core';
import { askSecret } from '../ask-secret';

describe('setup/first-run', () => {
  const baseSettings = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://old.example',
    apiKey: '',
    systemPrompt: '',
    enableSessionSaving: false,
  } as EndpointSettings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats empty raw settings as first run', () => {
    vi.mocked(loadRawSettingsFromFile).mockReturnValue({});

    expect(isFirstRun()).toBe(true);
  });

  it('treats existing raw settings as not first run', () => {
    vi.mocked(loadRawSettingsFromFile).mockReturnValue({ provider: 'openai' });

    expect(isFirstRun()).toBe(false);
  });

  it('returns the original settings when the provider choice is invalid', async () => {
    const rl = {
      question: vi.fn().mockResolvedValue('99'),
    } as unknown as Parameters<typeof runFirstRunSetup>[0];

    const result = await runFirstRunSetup(rl, baseSettings);

    expect(result).toBe(baseSettings);
    expect(askSecret).not.toHaveBeenCalled();
  });

  it('updates provider, model, and base URL for a standard provider choice', async () => {
    const rl = {
      question: vi.fn().mockResolvedValue('1'),
    } as unknown as Parameters<typeof runFirstRunSetup>[0];

    const result = await runFirstRunSetup(rl, baseSettings);

    expect(result).toEqual({
      ...baseSettings,
      provider: 'openai',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
    });
    expect(askSecret).not.toHaveBeenCalled();
  });

  it('prompts for custom provider details when custom is selected', async () => {
    const rl = {
      question: vi
        .fn()
        .mockResolvedValueOnce('2')
        .mockResolvedValueOnce('http://custom.example/v1'),
    } as unknown as Parameters<typeof runFirstRunSetup>[0];
    vi.mocked(askSecret).mockResolvedValue('custom-key');

    const result = await runFirstRunSetup(rl, baseSettings);

    expect(result).toEqual({
      ...baseSettings,
      provider: 'custom',
      model: 'custom-model',
      baseUrl: 'http://custom.example/v1',
      apiKey: 'custom-key',
    });
  });
});