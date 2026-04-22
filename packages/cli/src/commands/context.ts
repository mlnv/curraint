import { stdout as output } from 'node:process';
import { c } from '../theme';
import type { CommandContext, CommandResult } from './types';

export function runContext(ctx: CommandContext, text: string): CommandResult {
  const session = ctx.getSession();
  const action = text.slice('/context'.length).trim();

  if (!action) {
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  if (action !== 'summarize') {
    output.write('Usage: /context or /context summarize\n');
    return 'continue';
  }

  const didCompact = session.compactContext({
    maxMessages: ctx.getSettings().contextMaxMessages,
    maxCharacters: ctx.getSettings().contextMaxCharacters
  });

  if (!didCompact) {
    output.write('Nothing to summarize yet. Context already fits within the current limits.\n');
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  output.write(
    `${c.green}Context summarized for AI.${c.reset} Older messages remain in /history and the live transcript.\n`
  );
  ctx.sessionUI.printContextUsage(session, ctx.getSettings());
  return 'continue';
}