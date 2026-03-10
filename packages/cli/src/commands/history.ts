import type { CommandContext, CommandResult } from './types';

export function runHistory(ctx: CommandContext): CommandResult {
  ctx.sessionUI.printHistory(ctx.getSession());
  return 'continue';
}
