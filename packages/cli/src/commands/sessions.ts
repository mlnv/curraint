import { stdout as output } from 'node:process';
import { listSessions, getSession } from '@curraint/core';
import { c } from '../theme';
import type { CommandContext, CommandResult } from './types';

export async function runSessions(ctx: CommandContext): Promise<CommandResult> {
  if (!ctx.getSettings().enableSessionSaving) {
    output.write(
      `Session saving is disabled. Enable it in settings (${c.cyan}${ctx.getSettingsFilePath()}${c.reset}) to save conversations.\n`
    );
    return 'continue';
  }

  const sessions = listSessions();
  if (sessions.length === 0) {
    output.write('No saved sessions yet.\n');
    return 'continue';
  }

  output.write(`${c.bold}Saved sessions:${c.reset}\n`);
  sessions.forEach((s, i) => {
    const date = new Date(s.updatedAt).toLocaleString();
    output.write(
      `  ${c.cyan}${i + 1}.${c.reset} ${s.title}${c.dim} · ${s.messageCount} msg${s.messageCount !== 1 ? 's' : ''} · ${date}${c.reset}\n`
    );
  });
  output.write(`  ${c.dim}0. Cancel${c.reset}\n`);

  const answer = (
    await ctx.rl.question(`${c.green}Pick a session (or 0 to cancel):${c.reset} `)
  ).trim();

  const picked = parseInt(answer, 10);
  if (isNaN(picked) || picked === 0 || picked < 1 || picked > sessions.length) {
    output.write('Cancelled.\n');
    return 'continue';
  }

  const chosen = sessions[picked - 1]!;
  const full = getSession(chosen.id);
  if (!full) {
    output.write('Session not found.\n');
    return 'continue';
  }

  ctx.getSession().loadConversation(full.messages, full.compactedContext ?? null);
  ctx.setCurrentSessionId(chosen.id, chosen.createdAt);
  const compactedContextNote = full.compactedContext
    ? ' with restored compacted context (summary)'
    : '';
  output.write(
    `${c.green}Loaded:${c.reset} ${full.title} ${c.dim}(${full.messages.length} messages${compactedContextNote})${c.reset}\n`
  );
  ctx.sessionUI.printHistory(ctx.getSession());
  return 'continue';
}
