import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { DEFAULT_SETTINGS } from '../common/defaults';
import type { EndpointSettings } from '../common/types';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): EndpointSettings {
  const filePath = settingsPath();
  if (!existsSync(filePath)) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<EndpointSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: EndpointSettings): EndpointSettings {
  const filePath = settingsPath();
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
