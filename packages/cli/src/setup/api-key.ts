import readline from 'node:readline/promises';
import { stdout as output } from 'node:process';
import {
  normalizeSettings,
  requiresApiKeyForProvider,
  saveSettingsToFile,
  settingsFilePath,
} from '@curraint/core';
import type { EndpointSettings } from '@curraint/core';
import { askSecret } from '../ask-secret';

export async function askForApiKeyIfNeeded(
  rl: readline.Interface,
  settings: EndpointSettings,
  firstRun: boolean,
): Promise<EndpointSettings | null> {
  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey) {
    output.write(`No API key configured for provider "${settings.provider}".\n`);
    const key = await askSecret(rl, 'Enter API key: ');
    const trimmedKey = key?.trim();
    if (!trimmedKey) {
      output.write('API key is required. Exiting.\n');
      return null;
    }

    const updated = normalizeSettings({ ...settings, apiKey: trimmedKey });
    const save = (await rl.question('Save to settings file for future use? [Y/n] ')).trim().toLowerCase();
    if (save !== 'n') {
      saveSettingsToFile(updated);
      output.write(`Settings saved to ${settingsFilePath()}.\n`);
    }
    return updated;
  }

  if (firstRun) {
    saveSettingsToFile(settings);
    output.write(`Settings saved to ${settingsFilePath()}.\n`);
  }

  return settings;
}