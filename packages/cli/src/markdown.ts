import { Marked, marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

const HEADING_STYLES = [
  `\x1b[35m\x1b[1m\x1b[4m`, // h1: magenta bold underline
  `\x1b[36m\x1b[1m`,         // h2: cyan bold
  `\x1b[32m\x1b[1m`,         // h3: green bold
  `\x1b[33m\x1b[1m`,         // h4: yellow bold
  `\x1b[1m`,                  // h5: bold
  `\x1b[2m`,                  // h6: dim
] as const;

export function createMarkedInstance(width = 80): Marked {
  const m = new Marked();
  m.use(markedTerminal({ width }));
  m.use({
    renderer: {
      heading(token: { tokens: object[]; depth: number }): string {
        const style = HEADING_STYLES[Math.min(token.depth - 1, HEADING_STYLES.length - 1)]!;
        const prefix = '#'.repeat(token.depth) + ' ';
        const inner = (this as unknown as { parser: { parseInline(t: object[]): string } })
          .parser.parseInline(token.tokens);
        return `\n${style}${prefix}${inner}\x1b[0m\n\n`;
      },
    },
  });
  return m;
}

// Singleton used by the CLI at runtime.
const _marked = createMarkedInstance(Math.min(process.stdout.columns ?? 80, 100));

export function renderMarkdown(text: string): string {
  return (_marked.parse(text) as string).trim();
}
