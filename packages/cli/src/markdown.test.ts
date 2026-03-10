import { describe, expect, it } from 'vitest';
import { createMarkedInstance } from './markdown';

// Use a fixed width so tests are deterministic regardless of terminal size.
const render = (md: string) => (createMarkedInstance(80).parse(md) as string).trimEnd();

// Strip all ANSI escape codes to compare plain text content.
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('renderMarkdown — headings', () => {
  it('h1 contains the heading text', () => {
    expect(strip(render('# Hello World'))).toContain('# Hello World');
  });

  it('h2 contains the heading text', () => {
    expect(strip(render('## Section Two'))).toContain('## Section Two');
  });

  it('h1 is styled differently from h2', () => {
    const h1 = render('# Title');
    const h2 = render('## Title');
    // The ANSI prefix bytes should differ between levels.
    expect(h1).not.toBe(h2);
  });

  it('each heading level applies an ANSI escape code', () => {
    for (let level = 1; level <= 6; level++) {
      const result = render('#'.repeat(level) + ' Heading');
      expect(result, `h${level} should contain ANSI codes`).toMatch(/\x1b\[/);
    }
  });
});

describe('renderMarkdown — inline code', () => {
  it('renders inline code with ANSI styling', () => {
    const result = render('Use `console.log()` here');
    expect(result).toMatch(/\x1b\[/);
    expect(strip(result)).toContain('console.log()');
  });
});

describe('renderMarkdown — fenced code blocks', () => {
  it('renders code block content', () => {
    const md = '```js\nconst x = 1;\n```';
    const result = render(md);
    expect(strip(result)).toContain('const x = 1;');
  });

  it('applies syntax highlighting ANSI codes', () => {
    const md = '```js\nconst x = 1;\n```';
    expect(render(md)).toMatch(/\x1b\[/);
  });
});

describe('renderMarkdown — tables', () => {
  const tableInput = '| Name | Score |\n|------|-------|\n| Alice | 10 |\n| Bob | 20 |\n';

  it('renders table header cells', () => {
    expect(strip(render(tableInput))).toContain('Name');
    expect(strip(render(tableInput))).toContain('Score');
  });

  it('renders table body cells', () => {
    const output = strip(render(tableInput));
    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
    expect(output).toContain('10');
    expect(output).toContain('20');
  });

  it('draws table borders', () => {
    // cli-table3 draws box-drawing characters.
    const result = render(tableInput);
    expect(result).toMatch(/[┌┐└┘├┤┬┴┼─│]/);
  });
});

describe('renderMarkdown — bold and italic', () => {
  it('bold text has ANSI bold code', () => {
    const result = render('**important**');
    expect(result).toContain('\x1b[1m');
    expect(strip(result)).toContain('important');
  });

  it('italic text has ANSI italic code', () => {
    const result = render('_note_');
    expect(result).toContain('\x1b[3m');
    expect(strip(result)).toContain('note');
  });
});

describe('renderMarkdown — lists', () => {
  it('renders unordered list items', () => {
    const output = strip(render('- apples\n- bananas\n- cherries\n'));
    expect(output).toContain('apples');
    expect(output).toContain('bananas');
    expect(output).toContain('cherries');
  });
});
