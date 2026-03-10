import readline from 'node:readline/promises';
import { stdout as output } from 'node:process';
import { c } from './theme';

export const SLASH_COMMANDS: Array<{ command: string; description: string }> = [
  { command: '/help',     description: 'Show commands' },
  { command: '/history',  description: 'Show conversation history' },
  { command: '/edit',     description: 'Edit a user message and regenerate' },
  { command: '/provider', description: 'Switch the AI provider' },
  { command: '/model',    description: 'Change the model' },
  { command: '/version',  description: 'Show version' },
  { command: '/clear',    description: 'Clear the screen' },
  { command: '/exit',     description: 'Quit' },
];

/**
 * Reads a line of input. When running in a real TTY, shows a slash-command
 * completion menu as the user types "/" and supports navigating with arrow
 * keys and accepting with Tab or Enter. Falls back to plain readline in
 * non-TTY (piped) environments.
 */
export async function readLineWithCompletion(rl: readline.Interface, prompt: string): Promise<string> {
  const stdin = process.stdin as NodeJS.ReadStream;
  if (!stdin.isTTY) {
    return rl.question(prompt);
  }

  return new Promise<string>((resolve) => {
    let buf = '';
    let suggestions: typeof SLASH_COMMANDS = [];
    let selectedIdx = 0;

    const savedListeners = stdin.rawListeners('data').slice() as ((...args: unknown[]) => void)[];
    savedListeners.forEach(fn => stdin.removeListener('data', fn));

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    output.write(prompt);

    const redraw = () => {
      let out = '\r\x1b[J' + prompt + buf;

      if (suggestions.length > 0) {
        out += '\n';
        suggestions.forEach((s, i) => {
          if (i === selectedIdx) {
            out += `\x1b[7m  ${s.command.padEnd(12)} ${s.description}\x1b[0m`;
          } else {
            out += `  ${c.cyan}${s.command.padEnd(12)}${c.reset}${c.dim} ${s.description}${c.reset}`;
          }
          if (i < suggestions.length - 1) out += '\n';
        });
        out += `\x1b[${suggestions.length}A\r${prompt}${buf}`;
      }

      output.write(out);
    };

    const updateSuggestions = () => {
      if (buf.startsWith('/') && !buf.includes(' ')) {
        suggestions = SLASH_COMMANDS.filter(s => s.command.startsWith(buf));
        if (selectedIdx >= suggestions.length) selectedIdx = 0;
      } else {
        suggestions = [];
        selectedIdx = 0;
      }
      redraw();
    };

    const cleanup = () => {
      output.write('\r\x1b[J');
      output.write(prompt + buf + '\n');
      stdin.setRawMode(false);
      savedListeners.forEach(fn => stdin.on('data', fn));
    };

    const onData = (char: string) => {
      if (char === '\x1b[A') { // Up arrow
        if (suggestions.length > 0) {
          selectedIdx = (selectedIdx - 1 + suggestions.length) % suggestions.length;
          redraw();
        }
        return;
      }
      if (char === '\x1b[B') { // Down arrow
        if (suggestions.length > 0) {
          selectedIdx = (selectedIdx + 1) % suggestions.length;
          redraw();
        }
        return;
      }

      switch (char) {
        case '\r':
        case '\n':
          if (suggestions.length > 0) {
            buf = suggestions[selectedIdx]!.command;
            suggestions = [];
            selectedIdx = 0;
          }
          stdin.removeListener('data', onData);
          cleanup();
          resolve(buf);
          break;

        case '\t':
          if (suggestions.length > 0) {
            buf = suggestions[selectedIdx]!.command;
            suggestions = [];
            selectedIdx = 0;
            redraw();
          }
          break;

        case '\x1b': // Escape — dismiss menu
          suggestions = [];
          selectedIdx = 0;
          redraw();
          break;

        case '\u0003': // Ctrl+C
          stdin.removeListener('data', onData);
          output.write('\r\x1b[J\n');
          stdin.setRawMode(false);
          savedListeners.forEach(fn => stdin.on('data', fn));
          process.exit(0);
          break;

        case '\u007f': // Backspace
        case '\b':
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            updateSuggestions();
          }
          break;

        default:
          if (char.length === 1 && char >= ' ') {
            buf += char;
            updateSuggestions();
          }
          break;
      }
    };

    stdin.on('data', onData);
  });
}
