import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { DEFAULT_SETTINGS } from './defaults';
import { normalizeSettings } from './settings';
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

export function loadSettingsFromFile(): EndpointSettings {
  const filePath = settingsFilePath();
  if (!existsSync(filePath)) {
    return normalizeSettings(DEFAULT_SETTINGS);
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<EndpointSettings>;
    return normalizeSettings(parsed);
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

export function saveSettingsToFile(next: EndpointSettings): EndpointSettings {
  const normalized = normalizeSettings(next);
  const filePath = settingsFilePath();
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}
