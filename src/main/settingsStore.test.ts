import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../common/defaults';

const loadSettingsFromFileMock = vi.fn();
const saveSettingsToFileMock = vi.fn();

vi.mock('../common/settingsFile', () => ({
  loadSettingsFromFile: loadSettingsFromFileMock,
  saveSettingsToFile: saveSettingsToFileMock,
  settingsFilePath: () => '/mock-user-data/settings.json'
}));

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates loadSettings to loadSettingsFromFile', async () => {
    loadSettingsFromFileMock.mockReturnValue(DEFAULT_SETTINGS);

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(loadSettingsFromFileMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('delegates saveSettings to saveSettingsToFile', async () => {
    const expected = { ...DEFAULT_SETTINGS, apiKey: 'key' };
    saveSettingsToFileMock.mockReturnValue(expected);

    const { saveSettings } = await import('./settingsStore');
    const result = saveSettings(expected);

    expect(saveSettingsToFileMock).toHaveBeenCalledWith(expected);
    expect(result).toEqual(expected);
  });
});

