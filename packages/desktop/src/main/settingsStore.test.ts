import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../appSettings';

const { loadRawMock, saveRawMock, loadSecretMock, saveSecretMock, deleteSecretMock, loadSettingsFileMock } =
  vi.hoisted(() => ({
    loadRawMock: vi.fn(),
    saveRawMock: vi.fn(),
    loadSecretMock: vi.fn().mockReturnValue(''),
    saveSecretMock: vi.fn(),
    deleteSecretMock: vi.fn(),
    loadSettingsFileMock: vi.fn(),
  }));

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    loadRawSettingsFromFile: loadRawMock,
    saveRawSettingsToFile: saveRawMock,
    loadSecret: loadSecretMock,
    saveSecret: saveSecretMock,
    deleteSecret: deleteSecretMock,
    loadSettingsFromFile: loadSettingsFileMock,
  };
});

vi.mock('../appSettings', async (importActual) => {
  const actual = await importActual<typeof import('../appSettings')>();
  return {
    ...actual,
    migrateSavedConnectionsToProfiles: vi.fn(),
  };
});

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSecretMock.mockReturnValue('');
    loadSettingsFileMock.mockReturnValue({ ...DEFAULT_APP_SETTINGS, apiKey: '' });
  });

  it('loads and normalizes settings from raw file', async () => {
    loadRawMock.mockReturnValue({ theme: 'monokai' });
    loadSettingsFileMock.mockReturnValue({
      ...DEFAULT_APP_SETTINGS,
      apiKey: 'my-key',
    });

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(result.apiKey).toBe('my-key');
    expect(result.theme).toBe('monokai');
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
    expect(written['apiKey']).toBeUndefined();
    expect(saveSecretMock).toHaveBeenCalledWith('profile:default:apiKey', 'new-key');
  });

  it('does not write legacy plaintext apiKey back to raw settings', async () => {
    const existing = { apiKey: 'legacy-plaintext-key', theme: 'monokai' };
    loadRawMock.mockReturnValue(existing);
    saveRawMock.mockImplementation(() => {});

    const { saveSettings } = await import('./settingsStore');
    saveSettings({ ...DEFAULT_APP_SETTINGS, apiKey: 'new-key' });

    expect(saveRawMock).toHaveBeenCalledTimes(1);
    const written = saveRawMock.mock.calls[0][0] as Record<string, unknown>;
    expect(written['apiKey']).toBeUndefined();
    expect(written['theme']).toBe('black');
    expect(saveSecretMock).toHaveBeenCalledWith('profile:default:apiKey', 'new-key');
  });
});
