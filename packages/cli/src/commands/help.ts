import { stdout as output } from 'node:process';
import { c } from '../theme';
import type { CommandResult } from './types';

export function runHelp(): CommandResult {
  output.write(`${c.bold}Commands:${c.reset}\n`);
  output.write(`  ${c.cyan}/help${c.reset}           ${c.dim}Show commands${c.reset}\n`);
  output.write(`  ${c.cyan}/history${c.reset}        ${c.dim}Show conversation history${c.reset}\n`);
  output.write(`  ${c.cyan}/sessions${c.reset}       ${c.dim}Browse and resume saved sessions${c.reset}\n`);
  output.write(`  ${c.cyan}/sessions-save${c.reset}  ${c.dim}Enable or disable session saving (on/off)${c.reset}\n`);
  output.write(`  ${c.cyan}/edit${c.reset} <number>  ${c.dim}Edit a user message and regenerate from there${c.reset}\n`);
  output.write(`  ${c.cyan}/provider${c.reset}       ${c.dim}Switch the AI provider${c.reset}\n`);
  output.write(`  ${c.cyan}/model${c.reset}          ${c.dim}Change the model for the current provider${c.reset}\n`);
  output.write(`  ${c.cyan}/version${c.reset}        ${c.dim}Show version${c.reset}\n`);
  output.write(`  ${c.cyan}/clear${c.reset}          ${c.dim}Clear the screen${c.reset}\n`);
  output.write(`  ${c.cyan}/exit${c.reset}           ${c.dim}Quit${c.reset}\n`);
  output.write(`${c.dim}Tip: press Ctrl+C while streaming to stop the current response.${c.reset}\n`);
  return 'continue';
}
