import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { loadSecret, saveSecret } from '../secrets/manager';
import { DEFAULT_SETTINGS } from './defaults';
import { normalizeSettings } from './normalizer';
import { settingsFilePath } from './paths';
import type { EndpointSettings } from './types';

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

export function loadSettingsFromFile(): EndpointSettings {
  const raw = loadRawSettingsFromFile();
  const base =
    Object.keys(raw).length === 0
      ? normalizeSettings(DEFAULT_SETTINGS)
      : normalizeSettings(raw as Partial<EndpointSettings>);
  return { ...base, apiKey: loadSecret('apiKey') };
}

/**
 * Saves core settings, merging with the existing file so desktop-specific
 * fields (theme, shortcuts, saved connections) are not lost.
 */
export function saveSettingsToFile(next: EndpointSettings): EndpointSettings {
  const normalized = normalizeSettings(next);
  const existing = loadRawSettingsFromFile();
  saveSecret('apiKey', normalized.apiKey);
  const { apiKey: _omit, ...withoutApiKey } = normalized;
  saveRawSettingsToFile({ ...existing, ...withoutApiKey });
  return normalized;
}
