import { stdout as output } from 'node:process';
import { version } from '../../package.json';
import { runHelp } from './help';
import { runHistory } from './history';
import { runEdit } from './edit';
import { runRetry } from './retry';
import { runProvider } from './provider';
import { runModel } from './model';
import { runSessions } from './sessions';
import { runSessionsSave } from './sessions-save';
import { runProfile } from './profile';
import type { CommandContext, CommandResult } from './types';

export async function dispatchSlashCommand(
  text: string,
  ctx: CommandContext,
): Promise<CommandResult | null> {
  if (text === '/help')     return runHelp();
  if (text === '/history')  return runHistory(ctx);
  if (text === '/sessions') return runSessions(ctx);
  if (text.startsWith('/sessions-save')) return runSessionsSave(ctx, text.slice('/sessions-save'.length).trim());
  if (text === '/version')  { output.write(`${version}\n`); return 'continue'; }
  if (text === '/clear')    {
    output.write('\x1b[2J\x1b[H');
    ctx.setCurrentSessionId(null);
    return 'continue';
  }
  if (text === '/exit')     return 'break';
  if (text === '/provider') return runProvider(ctx);
  if (text === '/model')    return runModel(ctx);
  if (text.startsWith('/profile')) return runProfile(ctx, text.slice('/profile'.length).trim());
  if (text.startsWith('/edit')) return runEdit(text, ctx);
  if (text === '/retry')    return runRetry(ctx);
  if (text.startsWith('/')) {
    output.write(`Unknown command "${text}". Type /help for available commands.\n`);
    return 'continue';
  }
  return null; // not a slash command — treat as a chat message
}
