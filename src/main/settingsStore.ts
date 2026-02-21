import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { DEFAULT_SETTINGS } from '../common/defaults';
import { normalizeSettings } from '../common/settings';
import type { EndpointSettings } from '../common/types';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): EndpointSettings {
  const filePath = settingsPath();
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

export function saveSettings(next: EndpointSettings): EndpointSettings {
  const normalized = normalizeSettings(next);
  const filePath = settingsPath();
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}
