import { stdout as output } from 'node:process';
import { normalizeSettings, saveSettingsToFile } from '@curraint/core';
import { c } from '../theme';
import type { CommandContext, CommandResult } from './types';

export async function runSessionsSave(ctx: CommandContext, arg: string): Promise<CommandResult> {
  const current = ctx.getSettings();

  if (!arg) {
    const state = current.enableSessionSaving
      ? `${c.green}on${c.reset}`
      : `${c.dim}off${c.reset}`;
    output.write(`Session saving is currently ${state}.\n`);
    output.write(`Usage: ${c.cyan}/sessions-save on${c.reset} | ${c.cyan}/sessions-save off${c.reset}\n`);
    return 'continue';
  }

  if (arg !== 'on' && arg !== 'off') {
    output.write(`Expected "on" or "off". Usage: ${c.cyan}/sessions-save on${c.reset} | ${c.cyan}/sessions-save off${c.reset}\n`);
    return 'continue';
  }

  const enable = arg === 'on';
  if (enable === current.enableSessionSaving) {
    output.write(`Session saving is already ${arg}.\n`);
    return 'continue';
  }

  const next = normalizeSettings({ ...current, enableSessionSaving: enable });
  saveSettingsToFile(next);
  ctx.setSettings(next);

  output.write(
    enable
      ? `Session saving ${c.green}enabled${c.reset}. Conversations will be saved automatically.\n`
      : `Session saving ${c.dim}disabled${c.reset}. No new sessions will be saved.\n`
  );
  return 'continue';
}
