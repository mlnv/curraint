import { normalizeSettings, isProviderId } from '@curraint/core';
import type { AppSettings, SavedConnection, ThemeId } from './types';

const THEME_IDS: ThemeId[] = ['black', 'white', 'dark', 'monokai', 'retro-sand', 'retro-green'];

function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

function normalizeSavedConnections(raw: unknown): SavedConnection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: SavedConnection[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const c = item as Record<string, unknown>;
    if (typeof c['id'] !== 'string' || typeof c['name'] !== 'string') {
      continue;
    }

    result.push({
      id: c['id'],
      name: c['name'],
      provider:
        typeof c['provider'] === 'string' && isProviderId(c['provider'])
          ? c['provider']
          : 'custom',
      apiKey: typeof c['apiKey'] === 'string' ? c['apiKey'] : '',
      baseUrl: typeof c['baseUrl'] === 'string' ? c['baseUrl'] : '',
      model: typeof c['model'] === 'string' ? c['model'] : ''
    });
  }

  return result;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  theme: 'black',
  quickInputShortcut: 'CommandOrControl+Shift+A',
  savedConnections: [],
  enableThinkTagFolding: true,
  enableDebugLogging: false,
  enableSessionSaving: false
};

export function normalizeAppSettings(
  input: Partial<AppSettings> | AppSettings
): AppSettings {
  const core = normalizeSettings(input);
  return {
    ...core,
    enableThinkTagFolding:
      input.enableThinkTagFolding ?? DEFAULT_APP_SETTINGS.enableThinkTagFolding,
    enableDebugLogging:
      typeof input.enableDebugLogging === 'boolean'
        ? input.enableDebugLogging
        : DEFAULT_APP_SETTINGS.enableDebugLogging,
    savedConnections: normalizeSavedConnections(input.savedConnections),
    quickInputShortcut:
      typeof input.quickInputShortcut === 'string' && input.quickInputShortcut.trim()
        ? input.quickInputShortcut.trim()
        : DEFAULT_APP_SETTINGS.quickInputShortcut,
    theme: isThemeId(input.theme) ? input.theme : DEFAULT_APP_SETTINGS.theme
  };
}
