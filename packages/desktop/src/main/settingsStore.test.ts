import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../appSettings';

const { loadRawMock, saveRawMock, loadSecretMock, saveSecretMock, deleteSecretMock } =
  vi.hoisted(() => ({
    loadRawMock: vi.fn(),
    saveRawMock: vi.fn(),
    loadSecretMock: vi.fn().mockReturnValue(''),
    saveSecretMock: vi.fn(),
    deleteSecretMock: vi.fn()
  }));

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    loadRawSettingsFromFile: loadRawMock,
    saveRawSettingsToFile: saveRawMock,
    loadSecret: loadSecretMock,
    saveSecret: saveSecretMock,
    deleteSecret: deleteSecretMock
  };
});

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSecretMock.mockReturnValue('');
  });

  it('loads and normalizes settings from raw file', async () => {
    loadRawMock.mockReturnValue({ theme: 'monokai' });
    loadSecretMock.mockReturnValue('my-key');

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(loadRawMock).toHaveBeenCalledTimes(1);
    expect(result.apiKey).toBe('my-key');
    expect(result.theme).toBe('monokai');
  });

  it('preserves a stored copilot provider while normalizing saved settings', async () => {
    loadRawMock.mockReturnValue({ provider: 'copilot' });

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(result.provider).toBe('copilot');
  });

  it('returns default app settings when file is empty', async () => {
    loadRawMock.mockReturnValue({});

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('merges with existing data when saving to preserve unknown fields', async () => {
    const existing = { unknownField: 'keep-me', theme: 'monokai' };
    loadRawMock.mockReturnValue(existing);
    saveRawMock.mockImplementation(() => {});

    const { saveSettings } = await import('./settingsStore');
    saveSettings({ ...DEFAULT_APP_SETTINGS, apiKey: 'new-key' });

    expect(saveRawMock).toHaveBeenCalledTimes(1);
    const written = saveRawMock.mock.calls[0][0] as Record<string, unknown>;
    expect(written['unknownField']).toBe('keep-me');
    // apiKey is now stored in secrets, not raw settings
    expect(written['apiKey']).toBeUndefined();
    expect(saveSecretMock).toHaveBeenCalledWith('apiKey', 'new-key');
  });
});

