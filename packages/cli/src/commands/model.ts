import { stdout as output } from 'node:process';
import {
  ENABLE_COPILOT_PROVIDER,
  normalizeSettings,
  resetCopilotSession,
  saveSettingsToFile,
  settingsFilePath,
} from '@curraint/core';
import type { CommandContext, CommandResult } from './types';

export async function runModel(ctx: CommandContext): Promise<CommandResult> {
  const settings = ctx.getSettings();
  output.write(`Current model: ${settings.model} (provider: ${settings.provider})\n`);

  const newModel = (await ctx.rl.question('Enter new model name: ')).trim();
  if (!newModel) {
    output.write('No model entered. Model unchanged.\n');
    return 'continue';
  }
  if (newModel === settings.model) {
    output.write(`Already using model "${settings.model}".\n`);
    return 'continue';
  }

  const updated = normalizeSettings({ ...settings, model: newModel });

  if (ENABLE_COPILOT_PROVIDER && updated.provider === 'copilot') {
    await resetCopilotSession(updated.model, updated.systemPrompt);
  }

  ctx.rebuildSession(updated);

  const saveModel = (await ctx.rl.question('Save model change to settings file? [Y/n] ')).trim().toLowerCase();
  if (saveModel !== 'n') {
    saveSettingsToFile(updated);
    output.write(`Settings saved to ${settingsFilePath()}.\n`);
  }

  output.write(`Model changed to "${updated.model}". Conversation cleared.\n`);
  return 'continue';
}
