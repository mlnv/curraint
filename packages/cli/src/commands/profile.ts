import { stdout as output } from 'node:process';
import {
  DEFAULT_PROFILE_ID,
  loadSettingsFromFile,
  resolveProfile,
  saveProfilesToFile,
} from '@curraint/core';
import type { Profile, SettingsFileV2 } from '@curraint/core';
import { loadSecret } from '@curraint/core';
import type { CommandContext, CommandResult } from './types';

function profileApiKeySecretId(profileId: string): string {
  return `profile:${profileId}:apiKey`;
}

function generateProfileId(): string {
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `${Date.now()}-${rand}`;
}

function listProfiles(ctx: CommandContext): void {
  const profiles = ctx.getProfiles();
  const activeId = ctx.getActiveProfileId();
  const entries = Object.values(profiles.profiles);
  if (entries.length === 0) {
    output.write('No profiles configured.\n');
    return;
  }
  for (const p of entries) {
    const marker = p.id === activeId ? ' (active)' : '';
    const model = p.model ?? '(provider default)';
    output.write(`  ${p.id === activeId ? '▶' : ' '} ${p.name}  [${p.provider}] ${model}${marker}\n`);
  }
}

async function switchProfile(ctx: CommandContext, targetId: string): Promise<void> {
  const profiles = ctx.getProfiles();
  const target = profiles.profiles[targetId];
  if (!target) {
    output.write(`Profile "${targetId}" not found. Use /profile to list profiles.\n`);
    return;
  }
  if (targetId === profiles.activeProfileId) {
    output.write(`Already using profile "${target.name}".\n`);
    return;
  }

  profiles.activeProfileId = targetId;
  ctx.saveProfiles(profiles);
  saveProfilesToFile(profiles);

  const apiKey = loadSecret(profileApiKeySecretId(targetId));
  const resolved = resolveProfile(target, apiKey);
  ctx.rebuildSession(resolved);
  output.write(`Switched to profile "${target.name}" (${resolved.provider}/${resolved.model}). Conversation cleared.\n`);
}

async function createProfile(ctx: CommandContext, name: string): Promise<void> {
  if (!name) {
    output.write('Usage: /profile create <name>\n');
    return;
  }
  const profiles = ctx.getProfiles();
  const settings = ctx.getSettings();
  const id = generateProfileId();

  const newProfile: Profile = {
    id,
    name,
    provider: settings.provider,
    baseUrl: settings.baseUrl || undefined,
    model: settings.model || undefined,
    systemPrompt: settings.systemPrompt || undefined,
    contextMaxMessages: settings.contextMaxMessages,
    contextMaxCharacters: settings.contextMaxCharacters,
    enableSessionSaving: settings.enableSessionSaving,
  };

  profiles.profiles[id] = newProfile;
  ctx.saveProfiles(profiles);
  saveProfilesToFile(profiles);
  output.write(`Created profile "${name}" (id: ${id}).\n`);
}

async function deleteProfile(ctx: CommandContext, targetId: string): Promise<void> {
  if (!targetId) {
    output.write('Usage: /profile delete <id>\n');
    return;
  }
  const profiles = ctx.getProfiles();
  if (targetId === DEFAULT_PROFILE_ID) {
    output.write('Cannot delete the default profile.\n');
    return;
  }
  if (targetId === profiles.activeProfileId) {
    output.write('Cannot delete the active profile. Switch to another profile first with /profile switch <id>.\n');
    return;
  }
  const target = profiles.profiles[targetId];
  if (!target) {
    output.write(`Profile "${targetId}" not found.\n`);
    return;
  }

  delete profiles.profiles[targetId];
  ctx.saveProfiles(profiles);
  saveProfilesToFile(profiles);
  output.write(`Deleted profile "${target.name}".\n`);
}

export async function runProfile(ctx: CommandContext, args: string): Promise<CommandResult> {
  const trimmed = args.trim();

  if (!trimmed) {
    listProfiles(ctx);
    return 'continue';
  }

  if (trimmed.startsWith('switch ')) {
    await switchProfile(ctx, trimmed.slice(7).trim());
    return 'continue';
  }

  if (trimmed.startsWith('create ')) {
    await createProfile(ctx, trimmed.slice(7).trim());
    return 'continue';
  }

  if (trimmed.startsWith('delete ')) {
    await deleteProfile(ctx, trimmed.slice(7).trim());
    return 'continue';
  }

  output.write('Usage: /profile [list|switch <id>|create <name>|delete <id>]\n');
  return 'continue';
}
