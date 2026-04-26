import { stdout as output } from 'node:process';
import {
  CONTEXT_SAFETY_LIMIT_BOUNDS,
  DEFAULT_SETTINGS,
  loadSettingsFromFile,
  normalizeSettings,
  saveSettingsToFile,
} from '@curraint/core';
import { applyCliEnvironmentOverrides } from '../settings';
import type { CommandContext, CommandResult } from './types';

const LIMITS_USAGE =
  'Usage: /limits, /limits show, /limits set messages <count>, /limits set chars <count>, or /limits reset\n';

function hasContextLimitEnvOverrides(): boolean {
  return process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] !== undefined
    || process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'] !== undefined;
}

function printCurrentLimits(ctx: CommandContext): void {
  const settings = ctx.getSettings();
  output.write(`Message limit: ${settings.contextMaxMessages}\n`);
  output.write(`Character limit: ${settings.contextMaxCharacters}\n`);
  output.write(
    `Allowed ranges: messages ${CONTEXT_SAFETY_LIMIT_BOUNDS.minMessages}-${CONTEXT_SAFETY_LIMIT_BOUNDS.maxMessages}, chars ${CONTEXT_SAFETY_LIMIT_BOUNDS.minCharacters}-${CONTEXT_SAFETY_LIMIT_BOUNDS.maxCharacters}\n`
  );

  if (hasContextLimitEnvOverrides()) {
    output.write('Environment variables currently override the active session limits.\n');
  }
}

function parseIntegerLimit(raw: string): number | null {
  return /^-?\d+$/.test(raw) ? Number.parseInt(raw, 10) : null;
}

function printInvalidLimit(target: 'messages' | 'chars', raw: string): void {
  const label = target === 'messages' ? 'messages' : 'chars';
  const min = target === 'messages'
    ? CONTEXT_SAFETY_LIMIT_BOUNDS.minMessages
    : CONTEXT_SAFETY_LIMIT_BOUNDS.minCharacters;
  const max = target === 'messages'
    ? CONTEXT_SAFETY_LIMIT_BOUNDS.maxMessages
    : CONTEXT_SAFETY_LIMIT_BOUNDS.maxCharacters;

  output.write(`Invalid ${label} limit "${raw}". Enter an integer between ${min} and ${max}.\n`);
}

function persistAndRefreshSession(ctx: CommandContext, nextFileSettings: ReturnType<typeof ctx.getSettings>): void {
  const normalized = normalizeSettings(nextFileSettings);
  const savedSettings = saveSettingsToFile(normalized);
  const activeSettings = applyCliEnvironmentOverrides(savedSettings);
  ctx.rebuildSession(activeSettings, { preserveConversation: true });
}

export async function runLimits(ctx: CommandContext, text: string): Promise<CommandResult> {
  const action = text.slice('/limits'.length).trim();

  if (!action || action === 'show') {
    printCurrentLimits(ctx);
    return 'continue';
  }

  if (action === 'reset') {
    const fileSettings = loadSettingsFromFile();
    persistAndRefreshSession(ctx, {
      ...fileSettings,
      contextMaxMessages: DEFAULT_SETTINGS.contextMaxMessages,
      contextMaxCharacters: DEFAULT_SETTINGS.contextMaxCharacters,
    });
    output.write('Reset context limits to defaults.\n');
    if (hasContextLimitEnvOverrides()) {
      output.write('Saved to settings file, but the current session is still overridden by environment variables.\n');
    }
    return 'continue';
  }

  const parts = action.split(/\s+/);
  if (parts[0] !== 'set') {
    output.write(LIMITS_USAGE);
    printCurrentLimits(ctx);
    return 'continue';
  }

  if (parts[1] === 'messages' && parts.length === 3) {
    const parsed = parseIntegerLimit(parts[2]!);
    if (parsed === null) {
      printInvalidLimit('messages', parts[2]!);
      return 'continue';
    }

    const fileSettings = loadSettingsFromFile();
    const nextFileSettings = {
      ...fileSettings,
      contextMaxMessages: parsed,
    };
    const normalized = normalizeSettings(nextFileSettings);
    persistAndRefreshSession(ctx, nextFileSettings);
    output.write(`Saved message limit as ${normalized.contextMaxMessages}.\n`);
    if (hasContextLimitEnvOverrides()) {
      output.write('Saved to settings file, but the current session is still overridden by environment variables.\n');
    }
    return 'continue';
  }

  if ((parts[1] === 'chars' || parts[1] === 'char') && parts.length === 3) {
    const parsed = parseIntegerLimit(parts[2]!);
    if (parsed === null) {
      printInvalidLimit('chars', parts[2]!);
      return 'continue';
    }

    const fileSettings = loadSettingsFromFile();
    const nextFileSettings = {
      ...fileSettings,
      contextMaxCharacters: parsed,
    };
    const normalized = normalizeSettings(nextFileSettings);
    persistAndRefreshSession(ctx, nextFileSettings);
    output.write(`Saved character limit as ${normalized.contextMaxCharacters}.\n`);
    if (hasContextLimitEnvOverrides()) {
      output.write('Saved to settings file, but the current session is still overridden by environment variables.\n');
    }
    return 'continue';
  }

  output.write(LIMITS_USAGE);
  printCurrentLimits(ctx);
  return 'continue';
}