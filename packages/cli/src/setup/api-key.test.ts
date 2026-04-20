import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointSettings } from '@curraint/core';
import { askForApiKeyIfNeeded } from './api-key';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    normalizeSettings: vi.fn((settings: EndpointSettings) => settings),
    requiresApiKeyForProvider: vi.fn(),
    saveSettingsToFile: vi.fn(),
    settingsFilePath: vi.fn(() => '/config/settings.json'),
  };
});

vi.mock('../ask-secret', () => ({
  askSecret: vi.fn(),
}));

import {
  requiresApiKeyForProvider,
  saveSettingsToFile,
} from '@curraint/core';
import { askSecret } from '../ask-secret';

describe('setup/api-key', () => {
  const settings = {
    provider: 'openai',
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    systemPrompt: '',
    enableSessionSaving: false,
  } as EndpointSettings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the provider requires an API key and none is entered', async () => {
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);
    vi.mocked(askSecret).mockResolvedValue('');

    const result = await askForApiKeyIfNeeded(rl, settings, false);

    expect(result).toBeNull();
    expect(saveSettingsToFile).not.toHaveBeenCalled();
  });

  it('saves prompted API key settings when the user accepts persistence', async () => {
    const rl = {
      question: vi.fn().mockResolvedValue('Y'),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);
    vi.mocked(askSecret).mockResolvedValue('secret-key');

    const result = await askForApiKeyIfNeeded(rl, settings, false);

    expect(result).toEqual({
      ...settings,
      apiKey: 'secret-key',
    });
    expect(saveSettingsToFile).toHaveBeenCalledWith({
      ...settings,
      apiKey: 'secret-key',
    });
  });

  it('auto-saves first-run settings when no API key prompt is needed', async () => {
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    const localSettings = {
      ...settings,
      provider: 'lmstudio',
    } as EndpointSettings;
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(false);

    const result = await askForApiKeyIfNeeded(rl, localSettings, true);

    expect(result).toEqual(localSettings);
    expect(saveSettingsToFile).toHaveBeenCalledWith(localSettings);
  });

  it('leaves settings unchanged when an API key is already present', async () => {
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    const configuredSettings = {
      ...settings,
      apiKey: 'existing-key',
    } as EndpointSettings;
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);

    const result = await askForApiKeyIfNeeded(rl, configuredSettings, false);

    expect(result).toEqual(configuredSettings);
    expect(askSecret).not.toHaveBeenCalled();
    expect(saveSettingsToFile).not.toHaveBeenCalled();
  });
});