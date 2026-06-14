import {
  loadRawSettingsFromFile,
  saveRawSettingsToFile,
  loadSettingsFromFile,
  saveSecret,
} from '@curraint/core';
import { normalizeAppSettings, migrateSavedConnectionsToProfiles } from '../appSettings';
import type { AppSettings } from '../types';

function profileApiKeySecretId(profileId: string): string {
  return `profile:${profileId}:apiKey`;
}

export function loadSettings(): AppSettings {
  migrateSavedConnectionsToProfiles();
  const core = loadSettingsFromFile();

  const raw = loadRawSettingsFromFile();
  const extra = normalizeAppSettings({
    ...core,
    theme: raw['theme'] as AppSettings['theme'],
    quickInputShortcut: raw['quickInputShortcut'] as string,
    enableThinkTagFolding: raw['enableThinkTagFolding'] as boolean,
    enableDebugLogging: raw['enableDebugLogging'] as boolean,
  } as Partial<AppSettings>);

  return { ...core, ...extra };
}

export function saveSettings(next: AppSettings): AppSettings {
  const existing = loadRawSettingsFromFile();
  const activeId = (existing['activeProfileId'] as string) ?? 'default';

  saveSecret(profileApiKeySecretId(activeId), next.apiKey);

  const profiles = (existing['profiles'] as Record<string, Record<string, unknown>>) ?? {};
  const existingProfile = profiles[activeId] ?? {};
  profiles[activeId] = {
    id: activeId,
    name: existingProfile['name'] ?? 'Default',
    provider: next.provider,
    baseUrl: next.baseUrl || undefined,
    model: next.model || undefined,
    systemPrompt: next.systemPrompt || undefined,
    contextMaxMessages: next.contextMaxMessages,
    contextMaxCharacters: next.contextMaxCharacters,
    enableSessionSaving: next.enableSessionSaving,
  };

  const extraFields: Record<string, unknown> = {};
  for (const key of Object.keys(existing)) {
    if (key === 'version' || key === 'activeProfileId' || key === 'profiles') continue;
    extraFields[key] = existing[key];
  }
  extraFields['theme'] = next.theme;
  extraFields['quickInputShortcut'] = next.quickInputShortcut;
  extraFields['enableThinkTagFolding'] = next.enableThinkTagFolding;
  extraFields['enableDebugLogging'] = next.enableDebugLogging;

  saveRawSettingsToFile({
    version: 2,
    activeProfileId: activeId,
    profiles,
    ...extraFields,
  });

  return next;
}
