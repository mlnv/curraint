import { stdout as output } from 'node:process';
import {
  normalizeSettings,
  saveSettingsToFile,
  settingsFilePath,
  PROVIDER_MODELS,
} from '@curraint/core';
import type { CommandContext, CommandResult } from './types';

export async function runModel(ctx: CommandContext): Promise<CommandResult> {
  const settings = ctx.getSettings();
  const models = PROVIDER_MODELS[settings.provider] ?? [];

  output.write(`Current model: ${settings.model} (provider: ${settings.provider})\n`);

  if (models.length > 0) {
    output.write('Known models for this provider:\n');
    models.forEach((m, i) => {
      const marker = m.id === settings.model ? ' (current)' : '';
      const ctxInfo = m.contextWindow ? ` [${(m.contextWindow / 1000).toFixed(0)}k ctx]` : '';
      output.write(`  ${i + 1}. ${m.label}${ctxInfo}${marker}\n`);
    });
    output.write('  (or type any model name manually)\n');
  }

  const input = (await ctx.rl.question('Enter model name or number: ')).trim();
  if (!input) {
    output.write('No model entered. Model unchanged.\n');
    return 'continue';
  }

  let newModel: string;
  const choiceIdx = Number(input) - 1;
  if (Number.isInteger(choiceIdx) && choiceIdx >= 0 && choiceIdx < models.length) {
    newModel = models[choiceIdx]!.id;
  } else {
    newModel = input;
  }

  if (newModel === settings.model) {
    output.write(`Already using model "${settings.model}".\n`);
    return 'continue';
  }

  const updated = normalizeSettings({ ...settings, model: newModel });

  const saveModel = (await ctx.rl.question('Save model change to settings file? [Y/n] ')).trim().toLowerCase();
  if (saveModel !== 'n') {
    saveSettingsToFile(updated);
    output.write(`Settings saved to ${settingsFilePath()}.\n`);
  }

  ctx.rebuildSession(updated);
  output.write(`Model changed to "${updated.model}". Conversation cleared.\n`);
  return 'continue';
}
