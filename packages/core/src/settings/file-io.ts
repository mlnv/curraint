import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { loadSecret, saveSecret } from '../secrets/manager';
import { DEFAULT_PROFILE, DEFAULT_PROFILE_ID } from './defaults';
import { normalizeSettings, normalizeProfile, resolveProfile } from './normalizer';
import { settingsFilePath } from './paths';
import type { EndpointSettings, Profile, SettingsFileV2 } from './types';

export function loadRawSettingsFromFile(): Record<string, unknown> {
  const filePath = settingsFilePath();
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function saveRawSettingsToFile(data: Record<string, unknown>): void {
  const filePath = settingsFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function profileApiKeySecretId(profileId: string): string {
  return `profile:${profileId}:apiKey`;
}

function migrateV1ToV2(raw: Record<string, unknown>): SettingsFileV2 {
  const partial = raw as Partial<EndpointSettings>;
  const oldApiKey = loadSecret('apiKey');

  const profile: Profile = normalizeProfile({
    id: DEFAULT_PROFILE_ID,
    name: DEFAULT_PROFILE.name,
    provider: (partial.provider as Profile['provider']) ?? DEFAULT_PROFILE.provider,
    baseUrl: partial.baseUrl as string | undefined,
    model: partial.model as string | undefined,
    systemPrompt: partial.systemPrompt as string | undefined,
    contextMaxMessages: partial.contextMaxMessages as number | undefined,
    contextMaxCharacters: partial.contextMaxCharacters as number | undefined,
    enableSessionSaving: partial.enableSessionSaving as boolean | undefined,
  });

  saveSecret(profileApiKeySecretId(DEFAULT_PROFILE_ID), oldApiKey);

  return {
    version: 2,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: { [DEFAULT_PROFILE_ID]: profile },
  };
}

function isV2(raw: Record<string, unknown>): raw is Record<string, unknown> & { version: 2; activeProfileId: string; profiles: Record<string, unknown> } {
  return raw['version'] === 2
    && typeof raw['activeProfileId'] === 'string'
    && typeof raw['profiles'] === 'object'
    && raw['profiles'] !== null;
}

function loadOrMigrateSettingsFile(): SettingsFileV2 {
  const raw = loadRawSettingsFromFile();

  if (isV2(raw)) {
    return { version: 2, activeProfileId: raw.activeProfileId, profiles: raw.profiles as Record<string, Profile> };
  }

  const v2 = migrateV1ToV2(raw);
  // Persist the v2 structure, preserving any extra fields (e.g. desktop theme)
  const { version: _v, activeProfileId, profiles } = v2;
  const reservedKeys = new Set([
    'version', 'activeProfileId', 'profiles',
    'provider', 'apiKey', 'baseUrl', 'model',
    'systemPrompt', 'contextMaxMessages', 'contextMaxCharacters', 'enableSessionSaving',
  ]);
  const extraFields: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!reservedKeys.has(key)) {
      extraFields[key] = raw[key];
    }
  }
  saveRawSettingsToFile({ version: 2, activeProfileId, profiles, ...extraFields });
  return v2;
}

export function loadProfilesFromFile(): SettingsFileV2 {
  const raw = loadRawSettingsFromFile();
  if (Object.keys(raw).length === 0) {
    return {
      version: 2,
      activeProfileId: DEFAULT_PROFILE_ID,
      profiles: { [DEFAULT_PROFILE_ID]: { ...DEFAULT_PROFILE } },
    };
  }
  return loadOrMigrateSettingsFile();
}

export function saveProfilesToFile(v2: SettingsFileV2, extraFields?: Record<string, unknown>): void {
  const existing = loadRawSettingsFromFile();
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(existing)) {
    if (key === 'version' || key === 'activeProfileId' || key === 'profiles') continue;
    cleaned[key] = existing[key];
  }
  if (extraFields) {
    Object.assign(cleaned, extraFields);
  }
  saveRawSettingsToFile({
    version: v2.version,
    activeProfileId: v2.activeProfileId,
    profiles: v2.profiles,
    ...cleaned,
  });
}

/**
 * Loads settings for the current active profile, resolving secrets.
 * Backward-compatible: handles v1 migration transparently.
 */
export function loadSettingsFromFile(): EndpointSettings {
  const v2 = loadProfilesFromFile();
  const profile = v2.profiles[v2.activeProfileId];
  if (!profile) {
    const fallback = { ...DEFAULT_PROFILE };
    return resolveProfile(fallback, loadSecret(profileApiKeySecretId(DEFAULT_PROFILE_ID)));
  }
  return resolveProfile(profile, loadSecret(profileApiKeySecretId(profile.id)));
}

/**
 * Saves settings by updating the active profile, merging with the existing
 * file so desktop-specific fields are not lost.
 */
export function saveSettingsToFile(next: EndpointSettings): EndpointSettings {
  const normalized = normalizeSettings(next);
  const v2 = loadProfilesFromFile();
  const activeId = v2.activeProfileId;
  const existingProfile = v2.profiles[activeId];

  const updatedProfile: Profile = {
    id: activeId,
    name: existingProfile?.name ?? DEFAULT_PROFILE.name,
    provider: normalized.provider,
    baseUrl: normalized.baseUrl || undefined,
    model: normalized.model || undefined,
    systemPrompt: normalized.systemPrompt || undefined,
    contextMaxMessages: normalized.contextMaxMessages,
    contextMaxCharacters: normalized.contextMaxCharacters,
    enableSessionSaving: normalized.enableSessionSaving,
  };

  saveSecret(profileApiKeySecretId(activeId), normalized.apiKey);

  v2.profiles[activeId] = updatedProfile;
  const existing = loadRawSettingsFromFile();
  const extraFields: Record<string, unknown> = {};
  for (const key of Object.keys(existing)) {
    if (key === 'version' || key === 'activeProfileId' || key === 'profiles') continue;
    extraFields[key] = existing[key];
  }
  saveRawSettingsToFile({
    version: 2,
    activeProfileId: v2.activeProfileId,
    profiles: v2.profiles,
    ...extraFields,
  });

  return normalized;
}
