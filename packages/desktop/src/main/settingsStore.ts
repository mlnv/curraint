import { loadRawSettingsFromFile, saveRawSettingsToFile, loadSecret, saveSecret, deleteSecret } from '@curraint/core';
import { normalizeAppSettings, DEFAULT_APP_SETTINGS } from '../appSettings';
import type { AppSettings, SavedConnection } from '../types';

export function loadSettings(): AppSettings {
  const raw = loadRawSettingsFromFile();
  const base = Object.keys(raw).length === 0
    ? normalizeAppSettings(DEFAULT_APP_SETTINGS)
    : normalizeAppSettings(raw as Partial<AppSettings>);

  // Active API key is managed by core's loadSettingsFromFile → loadSecret('apiKey');
  // but here we re-read it explicitly since we go through loadRawSettingsFromFile directly.
  const apiKey = loadSecret('apiKey');

  // Inject saved-connection API keys from the secrets store.
  const savedConnections: SavedConnection[] = base.savedConnections.map(conn => ({
    ...conn,
    apiKey: loadSecret(`conn:${conn.id}`)
  }));

  return { ...base, apiKey, savedConnections };
}

export function saveSettings(next: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(next);
  const existing = loadRawSettingsFromFile();

  // Strip the active API key from JSON; store in secrets.
  saveSecret('apiKey', normalized.apiKey);

  // Strip per-connection API keys from JSON; store each one in secrets.
  // Also clean up secrets for any connections that are no longer present.
  const previousBase = normalizeAppSettings(existing as Partial<AppSettings>);
  const nextIds = new Set(normalized.savedConnections.map(c => c.id));
  previousBase.savedConnections.forEach(old => {
    if (!nextIds.has(old.id)) deleteSecret(`conn:${old.id}`);
  });
  normalized.savedConnections.forEach(conn => saveSecret(`conn:${conn.id}`, conn.apiKey));

  const savedConnectionsWithoutKeys = normalized.savedConnections.map(
    ({ apiKey: _k, ...rest }) => rest
  );

  const { apiKey: _omit, ...withoutApiKey } = normalized;
  saveRawSettingsToFile({
    ...existing,
    ...withoutApiKey,
    savedConnections: savedConnectionsWithoutKeys
  });

  return normalized;
}
