import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { DEFAULT_SETTINGS } from './defaults';
import { normalizeSettings } from './settings';
import { loadSecret, saveSecret } from './secretsFile';
import type { EndpointSettings } from './types';

const APP_NAME = 'curraint';

/**
 * Returns the platform-specific user data directory for the app.
 * Matches Electron's app.getPath('userData') so the CLI and Desktop share
 * the same settings file.
 */
export function userDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return join(process.env['APPDATA'] ?? join(process.env['USERPROFILE'] ?? '', 'AppData', 'Roaming'), APP_NAME);
    case 'darwin':
      return join(process.env['HOME'] ?? '', 'Library', 'Application Support', APP_NAME);
    default:
      return join(process.env['XDG_CONFIG_HOME'] ?? join(process.env['HOME'] ?? '', '.config'), APP_NAME);
  }
}

export function settingsFilePath(): string {
  return join(userDataDir(), 'settings.json');
}

/**
 * Low-level: reads the raw settings JSON from disk.
 * Returns an empty object when the file is absent or unparseable.
 * Consumers that need more than core fields (e.g. the Desktop app) call this
 * and apply their own normalization on top.
 */
export function loadRawSettingsFromFile(): Record<string, unknown> {
  const filePath = settingsFilePath();
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Low-level: writes a raw settings object to disk, creating dirs as needed.
 */
export function saveRawSettingsToFile(data: Record<string, unknown>): void {
  const filePath = settingsFilePath();
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function loadSettingsFromFile(): EndpointSettings {
  const raw = loadRawSettingsFromFile();
  const base = Object.keys(raw).length === 0
    ? normalizeSettings(DEFAULT_SETTINGS)
    : normalizeSettings(raw as Partial<EndpointSettings>);

  // API key is stored in secrets, not in the settings JSON.
  return { ...base, apiKey: loadSecret('apiKey') };
}

/**
 * Saves core settings, merging with the existing file so that desktop-specific
 * fields (theme, shortcuts, saved connections, …) are not lost when the CLI
 * writes back only the fields it knows about.
 */
export function saveSettingsToFile(next: EndpointSettings): EndpointSettings {
  const normalized = normalizeSettings(next);
  const existing = loadRawSettingsFromFile();

  // Persist the API key to the encrypted secrets file; strip it from JSON.
  saveSecret('apiKey', normalized.apiKey);
  const { apiKey: _omit, ...withoutApiKey } = normalized;
  saveRawSettingsToFile({ ...existing, ...withoutApiKey });

  return normalized;
}
