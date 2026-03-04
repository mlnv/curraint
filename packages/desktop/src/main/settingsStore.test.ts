import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../appSettings';

const { loadRawMock, saveRawMock } = vi.hoisted(() => ({
  loadRawMock: vi.fn(),
  saveRawMock: vi.fn()
}));

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    loadRawSettingsFromFile: loadRawMock,
    saveRawSettingsToFile: saveRawMock
  };
});

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and normalizes settings from raw file', async () => {
    loadRawMock.mockReturnValue({ apiKey: 'my-key' });

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(loadRawMock).toHaveBeenCalledTimes(1);
    expect(result.apiKey).toBe('my-key');
    expect(result.theme).toBe(DEFAULT_APP_SETTINGS.theme);
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
    expect(written['apiKey']).toBe('new-key');
  });
});

