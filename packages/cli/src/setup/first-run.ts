import readline from 'node:readline/promises';
import { stdout as output } from 'node:process';
import {
  loadRawSettingsFromFile,
  normalizeSettings,
  PROVIDER_OPTIONS,
  getProviderConfig,
} from '@curraint/core';
import type { EndpointSettings } from '@curraint/core';
import { askSecret } from '../ask-secret';

export function isFirstRun(): boolean {
  return Object.keys(loadRawSettingsFromFile()).length === 0;
}

async function promptCustomProviderDetails(
  rl: readline.Interface,
  settings: EndpointSettings,
  defaultBaseUrl: string,
): Promise<EndpointSettings> {
  const customUrl = (await rl.question(`Base URL [${defaultBaseUrl}]: `)).trim();
  let updated = customUrl
    ? normalizeSettings({ ...settings, baseUrl: customUrl })
    : settings;

  const key = await askSecret(rl, 'API key (leave blank if not required): ');
  if (key) {
    updated = normalizeSettings({ ...updated, apiKey: key });
  }

  return updated;
}

export async function runFirstRunSetup(
  rl: readline.Interface,
  settings: EndpointSettings,
): Promise<EndpointSettings> {
  output.write('Welcome to curraint! No settings found. Choose a provider to get started.\n');
  output.write('Available providers:\n');
  PROVIDER_OPTIONS.forEach((provider, index) => {
    output.write(`  ${index + 1}. ${provider.label}\n`);
  });

  let choice = '';
  let index = -1;
  while (true) {
    choice = (await rl.question(`Pick a provider [1-${PROVIDER_OPTIONS.length}]: `)).trim();
    index = Number(choice) - 1;
    if (Number.isInteger(index) && index >= 0 && index < PROVIDER_OPTIONS.length) {
      break;
    }
  }

  const selectedProvider = PROVIDER_OPTIONS[index]!;
  const providerDefaults = getProviderConfig(selectedProvider.id);
  let updated = normalizeSettings({
    ...settings,
    provider: selectedProvider.id,
    model: providerDefaults.defaultModel,
    baseUrl: providerDefaults.defaultBaseUrl,
  });

  output.write(`Provider set to: ${selectedProvider.label}\n`);

  if (selectedProvider.id === 'custom') {
    updated = await promptCustomProviderDetails(rl, updated, providerDefaults.defaultBaseUrl);
  }

  return updated;
}