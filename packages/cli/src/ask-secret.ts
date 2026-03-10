import readline from 'node:readline/promises';
import { stdout as output } from 'node:process';

/**
 * Prompts for a secret value (e.g. API key) without echoing characters to the
 * terminal. Uses raw mode to suppress OS-level PTY echo, temporarily removes
 * existing stdin listeners while reading, then restores them afterwards.
 */
export async function askSecret(rl: readline.Interface, prompt: string): Promise<string> {
  const stdin = process.stdin as NodeJS.ReadStream;

  if (!stdin.isTTY) {
    // Non-TTY (piped input): no echo risk, use readline normally.
    output.write(prompt);
    const answer = await (rl as unknown as { question(q: string): Promise<string> }).question('');
    return answer.trim();
  }

  const savedListeners = stdin.rawListeners('data').slice() as ((...args: unknown[]) => void)[];
  savedListeners.forEach(fn => stdin.removeListener('data', fn));

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  output.write(prompt);

  const value = await new Promise<string>((resolve) => {
    let buf = '';
    const onData = (char: string) => {
      switch (char) {
        case '\r':
        case '\n':
          stdin.removeListener('data', onData);
          resolve(buf);
          break;
        case '\u0003': // Ctrl+C
          stdin.removeListener('data', onData);
          output.write('\n');
          stdin.setRawMode(false);
          savedListeners.forEach(fn => stdin.on('data', fn));
          process.exit(0);
          break;
        case '\u007f': // Delete/Backspace
        case '\b':
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            output.write('\b \b'); // erase last asterisk
          }
          break;
        default:
          if (char >= ' ') {
            // When pasting, char may contain multiple characters at once.
            buf += char;
            output.write('*'.repeat(char.length));
          }
      }
    };
    stdin.on('data', onData);
  });

  stdin.setRawMode(false);
  output.write('\n');
  savedListeners.forEach(fn => stdin.on('data', fn));

  return value.trim();
}
