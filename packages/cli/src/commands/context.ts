import { stdout as output } from 'node:process';
import { c } from '../theme';
import type { CommandContext, CommandResult } from './types';

export async function runContext(ctx: CommandContext, text: string): Promise<CommandResult> {
  const session = ctx.getSession();
  const action = text.slice('/context'.length).trim();

  if (!action) {
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  if (action !== 'summarize') {
    output.write('Usage: /context or /context summarize\n');
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  if (session.getState().isCompactingContext) {
    output.write('Context summarization is already in progress. Please wait for it to finish.\n');
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  let didCompact = false;
  try {
    output.write('Summarizing older context...\n');
    didCompact = await session.compactContext({
      maxMessages: ctx.getSettings().contextMaxMessages,
      maxCharacters: ctx.getSettings().contextMaxCharacters
    });
  } catch (error) {
    output.write(
      `${c.red}Failed to summarize context:${c.reset} ${error instanceof Error ? error.message : 'Unknown error'}\n`
    );
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  if (!didCompact) {
    output.write('Nothing to summarize yet. There is not enough older context to compact.\n');
    ctx.sessionUI.printContextUsage(session, ctx.getSettings());
    return 'continue';
  }

  output.write(
    `${c.green}Context summarized for AI.${c.reset} Older messages remain in /history and the live transcript.\n`
  );
  ctx.sessionUI.printContextUsage(session, ctx.getSettings());
  return 'continue';
}