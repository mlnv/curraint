import { stdout as output } from 'node:process';
import type { CommandContext, CommandResult } from './types';

export async function runEdit(text: string, ctx: CommandContext): Promise<CommandResult> {
  const [, rawTurn] = text.split(/\s+/, 2);
  const turn = Number(rawTurn);
  const session = ctx.getSession();
  const userIndexes = ctx.sessionUI.getUserMessageIndexes(session.getState().conversation);

  if (!Number.isInteger(turn) || turn < 1 || turn > userIndexes.length) {
    output.write('Usage: /edit <user-message-number>. See /history for message numbers.\n');
    return 'continue';
  }

  const userMessageIndex = userIndexes[turn - 1]!;
  const current = session.getState().conversation[userMessageIndex]!;
  const edited = (await ctx.rl.question(`Edit message (${current.content}): `)).trim();

  if (!edited) {
    output.write('Edit cancelled.\n');
    return 'continue';
  }

  ctx.sessionUI.resetTurnState();
  await session.editUserMessage(userMessageIndex, edited);
  ctx.sessionUI.printFinalAssistantIfNeeded(session);
  return 'continue';
}
