import { stdout as output } from 'node:process';
import { c } from '../theme';
import type { CommandContext, CommandResult } from './types';

export async function runRetry(ctx: CommandContext): Promise<CommandResult> {
  const session = ctx.getSession();
  const conversation = session.getState().conversation;
  const userIndexes = ctx.sessionUI.getUserMessageIndexes(conversation);

  if (userIndexes.length === 0) {
    output.write('Nothing to retry. Send a message first.\n');
    return 'continue';
  }

  const lastUserMessage = conversation[userIndexes[userIndexes.length - 1]!]!;
  output.write(`${c.green}You:${c.reset} ${lastUserMessage.content}\n`);

  ctx.sessionUI.resetTurnState();
  await session.retryLastMessage();
  ctx.sessionUI.printFinalAssistantIfNeeded(session);
  return 'continue';
}
