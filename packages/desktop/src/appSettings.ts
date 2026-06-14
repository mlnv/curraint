import {
  normalizeSettings,
  isProviderId,
  DEFAULT_PROFILE_ID,
  normalizeProfile,
  loadRawSettingsFromFile,
  saveProfilesToFile,
  loadSecret,
  saveSecret,
} from '@curraint/core';
import type { Profile } from '@curraint/core';
import type { AppSettings, ThemeId } from './types';

const THEME_IDS: ThemeId[] = ['black', 'white', 'dark', 'monokai', 'retro-sand', 'retro-green'];

function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

function profileApiKeySecretId(profileId: string): string {
  return `profile:${profileId}:apiKey`;
}

/**
 * Migrates legacy savedConnections into profiles.
 * Called on load when the raw settings file still has a savedConnections array.
 */
export function migrateSavedConnectionsToProfiles(): void {
  const raw = loadRawSettingsFromFile();
  const connections = raw['savedConnections'];
  if (!Array.isArray(connections) || connections.length === 0) return;

  const profiles = (raw['profiles'] as Record<string, Profile> | undefined) ?? {};
  let changed = false;

  for (const item of connections) {
    if (typeof item !== 'object' || item === null) continue;
    const c = item as Record<string, unknown>;
    if (typeof c['id'] !== 'string' || typeof c['name'] !== 'string') continue;

    const profileId = c['id'];
    if (profiles[profileId]) continue; // already migrated

    const provider = typeof c['provider'] === 'string' && isProviderId(c['provider'])
      ? c['provider']
      : 'custom';

    profiles[profileId] = normalizeProfile({
      id: profileId,
      name: c['name'],
      provider,
      baseUrl: typeof c['baseUrl'] === 'string' ? c['baseUrl'] : undefined,
      model: typeof c['model'] === 'string' ? c['model'] : undefined,
    });

    // Migrate the saved connection's API key to profile secret
    const oldKey = loadSecret(`conn:${profileId}`);
    if (oldKey) {
      saveSecret(profileApiKeySecretId(profileId), oldKey);
    }

    changed = true;
  }

  if (changed) {
    // Build the v2 settings structure preserving extra fields
    const extraFields: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (key === 'version' || key === 'activeProfileId' || key === 'profiles' || key === 'savedConnections') continue;
      if (['provider', 'apiKey', 'baseUrl', 'model', 'systemPrompt', 'contextMaxMessages', 'contextMaxCharacters', 'enableSessionSaving'].includes(key)) continue;
      extraFields[key] = raw[key];
    }

    saveProfilesToFile(
      { version: 2, activeProfileId: raw['activeProfileId'] as string ?? DEFAULT_PROFILE_ID, profiles },
      extraFields,
    );
  }
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
    quickInputShortcut:
      typeof input.quickInputShortcut === 'string' && input.quickInputShortcut.trim()
        ? input.quickInputShortcut.trim()
        : DEFAULT_APP_SETTINGS.quickInputShortcut,
    theme: isThemeId(input.theme) ? input.theme : DEFAULT_APP_SETTINGS.theme
  };
}
