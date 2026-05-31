import { stdout as output } from 'node:process';
import {
  ENABLE_COPILOT_PROVIDER,
  getProviderConfig,
  normalizeSettings,
  PROVIDER_OPTIONS,
  requiresApiKeyForProvider,
  saveSettingsToFile,
  settingsFilePath,
} from '@curraint/core';
import { askSecret } from '../ask-secret';
import { loadSettings } from '../settings';
import type { CommandContext, CommandResult } from './types';

async function promptApiKeyForProvider(ctx: CommandContext, providerLabel: string): Promise<string | null> {
  const key = await askSecret(ctx.rl, `Enter API key for ${providerLabel}: `);
  if (!key) {
    output.write('API key is required for this provider. Provider unchanged.\n');
    return null;
  }
  return key;
}

async function promptCustomProviderDetails(ctx: CommandContext, defaultBaseUrl: string, settings: ReturnType<typeof ctx.getSettings>): Promise<ReturnType<typeof ctx.getSettings>> {
  const customUrl = (await ctx.rl.question(`Base URL [${defaultBaseUrl}]: `)).trim();
  if (customUrl) {
    settings = normalizeSettings({ ...settings, baseUrl: customUrl });
  }
  const key = await askSecret(ctx.rl, 'API key (leave blank if not required): ');
  if (key) {
    settings = normalizeSettings({ ...settings, apiKey: key });
  }
  return settings;
}

export async function runProvider(ctx: CommandContext): Promise<CommandResult> {
  const currentSettings = ctx.getSettings();

  output.write('Available providers:\n');
  PROVIDER_OPTIONS.forEach((p, i) => {
    const marker = p.id === currentSettings.provider ? ' (current)' : '';
    output.write(`  ${i + 1}. ${p.label}${marker}\n`);
  });

  const choice = (await ctx.rl.question(`Pick a provider [1-${PROVIDER_OPTIONS.length}]: `)).trim();
  const idx = Number(choice) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= PROVIDER_OPTIONS.length) {
    output.write('Invalid choice. Provider unchanged.\n');
    return 'continue';
  }

  const chosen = PROVIDER_OPTIONS[idx]!;
  if (chosen.id === currentSettings.provider) {
    output.write(`Already using ${chosen.label}.\n`);
    return 'continue';
  }

  const providerDefaults = getProviderConfig(chosen.id);
  let settings = normalizeSettings({
    ...currentSettings,
    provider: chosen.id,
    model: providerDefaults.defaultModel,
    baseUrl: providerDefaults.defaultBaseUrl,
    apiKey: '', // Always clear API key on provider switch.
  });

  if (providerDefaults.requiresApiKey) {
    const key = await promptApiKeyForProvider(ctx, chosen.label);
    if (!key) {
      ctx.setSettings(loadSettings());
      return 'continue';
    }
    settings = normalizeSettings({ ...settings, apiKey: key });
  }

  if (chosen.id === 'custom') {
    settings = await promptCustomProviderDetails(ctx, providerDefaults.defaultBaseUrl, settings);
  }

  const save = (await ctx.rl.question('Save provider change to settings file? [Y/n] ')).trim().toLowerCase();
  if (save !== 'n') {
    saveSettingsToFile(settings);
    output.write(`Settings saved to ${settingsFilePath()}.\n`);
  }

  ctx.rebuildSession(settings);
  output.write(`Switched to ${chosen.label} (${settings.model}). Conversation cleared.\n`);
  return 'continue';
}
