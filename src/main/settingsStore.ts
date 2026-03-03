import { loadSettingsFromFile, saveSettingsToFile } from '../common/settingsFile';
import type { EndpointSettings } from '../common/types';

export function loadSettings(): EndpointSettings {
  return loadSettingsFromFile();
}

export function saveSettings(next: EndpointSettings): EndpointSettings {
  return saveSettingsToFile(next);
}
