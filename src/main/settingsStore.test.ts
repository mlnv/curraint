import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../common/defaults';

const getPathMock = vi.fn(() => '/mock-user-data');
const existsSyncMock = vi.fn<(path: string) => boolean>();
const readFileSyncMock = vi.fn<(path: string, encoding: string) => string>();
const writeFileSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: getPathMock
  }
}));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  writeFileSync: writeFileSyncMock,
  mkdirSync: mkdirSyncMock
}));

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized defaults when settings file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('returns normalized defaults when settings file is malformed', async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue('{ malformed json');

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('loads and normalizes existing settings', async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        provider: 'openai',
        apiKey: '  key  ',
        baseUrl: '  https://api.example.com/v1  ',
        model: '  model  ',
        systemPrompt: '  prompt  ',
        enableThinkTagFolding: false,
        contextMaxMessages: 2,
        contextMaxCharacters: 500000
      })
    );

    const { loadSettings } = await import('./settingsStore');
    const result = loadSettings();

    expect(result.apiKey).toBe('key');
    expect(result.baseUrl).toBe('https://api.example.com/v1');
    expect(result.model).toBe('model');
    expect(result.systemPrompt).toBe('prompt');
    expect(result.enableThinkTagFolding).toBe(false);
    expect(result.contextMaxMessages).toBe(4);
    expect(result.contextMaxCharacters).toBe(200000);
  });

  it('saves normalized settings and ensures directory exists', async () => {
    existsSyncMock.mockReturnValue(false);

    const { saveSettings } = await import('./settingsStore');
    const saved = saveSettings({
      ...DEFAULT_SETTINGS,
      apiKey: '  key  ',
      contextMaxMessages: 500,
      contextMaxCharacters: 1
    });

    expect(saved.apiKey).toBe('key');
    expect(saved.contextMaxMessages).toBe(120);
    expect(saved.contextMaxCharacters).toBe(4000);
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
  });
});
