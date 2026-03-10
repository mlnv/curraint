import readline from 'node:readline/promises';
import { stdout as output } from 'node:process';
import {
  loadRawSettingsFromFile,
  normalizeSettings,
  requiresApiKeyForProvider,
  saveSettingsToFile,
  settingsFilePath,
  PROVIDER_OPTIONS,
  getProviderConfig,
} from '@curraint/core';
import type { EndpointSettings } from '@curraint/core';
import { askSecret } from './ask-secret';

export function isFirstRun(): boolean {
  return Object.keys(loadRawSettingsFromFile()).length === 0;
}

async function promptCustomUrl(rl: readline.Interface, settings: EndpointSettings, defaultBaseUrl: string): Promise<EndpointSettings> {
  const customUrl = (await rl.question(`Base URL [${defaultBaseUrl}]: `)).trim();
  if (customUrl) {
    return normalizeSettings({ ...settings, baseUrl: customUrl });
  }
  return settings;
}

async function promptProviderChoice(rl: readline.Interface, settings: EndpointSettings): Promise<EndpointSettings> {
  output.write('Welcome to curraint! No settings found. Choose a provider to get started.\n');
  output.write('Available providers:\n');
  PROVIDER_OPTIONS.forEach((p, i) => { output.write(`  ${i + 1}. ${p.label}\n`); });

  const choice = (await rl.question(`Pick a provider [1-${PROVIDER_OPTIONS.length}]: `)).trim();
  const idx = Number(choice) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= PROVIDER_OPTIONS.length) {
    return settings;
  }

  const chosen = PROVIDER_OPTIONS[idx]!;
  const providerDefaults = getProviderConfig(chosen.id);
  let updated = normalizeSettings({
    ...settings,
    provider: chosen.id,
    model: providerDefaults.defaultModel,
    baseUrl: providerDefaults.defaultBaseUrl,
  });

  output.write(`Provider set to: ${chosen.label}\n`);

  if (chosen.id === 'custom') {
    updated = await promptCustomUrl(rl, updated, providerDefaults.defaultBaseUrl);
    const key = await askSecret(rl, 'API key (leave blank if not required): ');
    if (key) {
      updated = normalizeSettings({ ...updated, apiKey: key });
    }
  }

  return updated;
}

export async function runFirstRunSetup(
  rl: readline.Interface,
  settings: EndpointSettings,
): Promise<EndpointSettings> {
  return promptProviderChoice(rl, settings);
}

export async function askForApiKeyIfNeeded(
  rl: readline.Interface,
  settings: EndpointSettings,
  firstRun: boolean,
): Promise<EndpointSettings | null> {
  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey) {
    output.write(`No API key configured for provider "${settings.provider}".\n`);
    const key = await askSecret(rl, 'Enter API key: ');
    if (!key) {
      output.write('API key is required. Exiting.\n');
      return null;
    }
    settings = normalizeSettings({ ...settings, apiKey: key });
    const save = (await rl.question('Save to settings file for future use? [Y/n] ')).trim().toLowerCase();
    if (save !== 'n') {
      saveSettingsToFile(settings);
      output.write(`Settings saved to ${settingsFilePath()}.\n`);
    }
  } else if (firstRun) {
    saveSettingsToFile(settings);
    output.write(`Settings saved to ${settingsFilePath()}.\n`);
  }
  return settings;
}
