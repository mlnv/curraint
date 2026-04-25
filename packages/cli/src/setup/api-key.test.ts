import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointSettings } from '@curraint/core';
import { askForApiKeyIfNeeded } from './api-key';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    normalizeSettings: vi.fn((settings: EndpointSettings) => actual.normalizeSettings(settings)),
    requiresApiKeyForProvider: vi.fn(),
    saveSettingsToFile: vi.fn(),
    settingsFilePath: vi.fn(() => '/config/settings.json'),
  };
});

vi.mock('../ask-secret', () => ({
  askSecret: vi.fn(),
}));

import {
  normalizeSettings,
  requiresApiKeyForProvider,
  saveSettingsToFile,
} from '@curraint/core';
import { askSecret } from '../ask-secret';

describe('setup/api-key', () => {
  const createSettings = (overrides: Partial<EndpointSettings> = {}): EndpointSettings => ({
    provider: 'openai',
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    systemPrompt: '',
    contextMaxMessages: 40,
    contextMaxCharacters: 24000,
    enableSessionSaving: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveSettingsToFile).mockImplementation((settings: EndpointSettings) => settings);
  });

  it('returns null when the provider requires an API key and none is entered', async () => {
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);
    vi.mocked(askSecret).mockResolvedValue('');

    const result = await askForApiKeyIfNeeded(rl, createSettings(), false);

    expect(result).toBeNull();
    expect(saveSettingsToFile).not.toHaveBeenCalled();
  });

  it('returns null when the entered API key is only whitespace', async () => {
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);
    vi.mocked(askSecret).mockResolvedValue('   ');

    const result = await askForApiKeyIfNeeded(rl, createSettings(), false);

    expect(result).toBeNull();
    expect(saveSettingsToFile).not.toHaveBeenCalled();
  });

  it('saves prompted API key settings when the user accepts persistence', async () => {
    const settings = createSettings();
    const updatedSettings = normalizeSettings({ ...settings, apiKey: ' secret-key ' });
    const rl = {
      question: vi.fn().mockResolvedValue('Y'),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);
    vi.mocked(askSecret).mockResolvedValue(' secret-key ');

    const result = await askForApiKeyIfNeeded(rl, settings, false);

    expect(result).toEqual(updatedSettings);
    expect(saveSettingsToFile).toHaveBeenCalledWith(updatedSettings);
  });

  it('returns the prompted API key without saving when the user declines persistence', async () => {
    const settings = createSettings();
    const updatedSettings = normalizeSettings({ ...settings, apiKey: ' secret-key ' });
    const rl = {
      question: vi.fn().mockResolvedValue('n'),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);
    vi.mocked(askSecret).mockResolvedValue(' secret-key ');

    const result = await askForApiKeyIfNeeded(rl, settings, false);

    expect(result).toEqual(updatedSettings);
    expect(saveSettingsToFile).not.toHaveBeenCalled();
  });

  it('auto-saves first-run settings when no API key prompt is needed', async () => {
    const localSettings = createSettings({
      provider: 'lmstudio',
      systemPrompt: '  prompt with padding  ',
    });
    const savedSettings = createSettings({
      provider: 'lmstudio',
      systemPrompt: 'prompt with padding',
    });
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(false);
    vi.mocked(saveSettingsToFile).mockReturnValue(savedSettings);

    const result = await askForApiKeyIfNeeded(rl, localSettings, true);

    expect(result).toEqual(savedSettings);
    expect(saveSettingsToFile).toHaveBeenCalledWith(localSettings);
    expect(rl.question).not.toHaveBeenCalled();
  });

  it('asks before saving first-run settings when an API key already exists', async () => {
    const configuredSettings = createSettings({
      provider: 'lmstudio',
      apiKey: 'existing-key',
    });
    const savedSettings = createSettings({
      provider: 'lmstudio',
      apiKey: 'existing-key',
      systemPrompt: 'normalized prompt',
    });
    const rl = {
      question: vi.fn().mockResolvedValue('Y'),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(false);
    vi.mocked(saveSettingsToFile).mockReturnValue(savedSettings);

    const result = await askForApiKeyIfNeeded(rl, configuredSettings, true);

    expect(result).toEqual(savedSettings);
    expect(rl.question).toHaveBeenCalledWith('Save to settings file for future use? [Y/n] ');
    expect(saveSettingsToFile).toHaveBeenCalledWith(configuredSettings);
  });

  it('leaves settings unchanged when an API key is already present', async () => {
    const configuredSettings = createSettings({
      apiKey: 'existing-key',
    });
    const rl = {
      question: vi.fn(),
    } as unknown as Parameters<typeof askForApiKeyIfNeeded>[0];
    vi.mocked(requiresApiKeyForProvider).mockReturnValue(true);

    const result = await askForApiKeyIfNeeded(rl, configuredSettings, false);

    expect(result).toEqual(configuredSettings);
    expect(askSecret).not.toHaveBeenCalled();
    expect(saveSettingsToFile).not.toHaveBeenCalled();
  });
});