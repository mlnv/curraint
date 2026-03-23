import { describe, it, expect } from 'vitest';
import { buildNoteContextMessage } from './note-context';
import type { App } from 'obsidian';

function makeApp(file: { basename: string } | null, content: string): App {
  return {
    workspace: { getActiveFile: () => file },
    vault: { read: async () => content },
  } as unknown as App;
}

describe('buildNoteContextMessage', () => {
  it('returns null when no file is open', async () => {
    const app = makeApp(null, '');
    expect(await buildNoteContextMessage(app)).toBeNull();
  });

  it('returns null when the note is blank', async () => {
    const app = makeApp({ basename: 'My Note' }, '   \n  ');
    expect(await buildNoteContextMessage(app)).toBeNull();
  });

  it('returns a system message containing the note title', async () => {
    const app = makeApp({ basename: 'My Note' }, '# Hello\nThis is my note.');
    const msg = await buildNoteContextMessage(app);
    expect(msg).not.toBeNull();
    expect(msg?.role).toBe('system');
    expect(msg?.content).toContain('My Note');
  });

  it('includes the full note content in the message', async () => {
    const content = '# Hello\nThis is my note.';
    const app = makeApp({ basename: 'Test' }, content);
    const msg = await buildNoteContextMessage(app);
    expect(msg?.content).toContain(content);
  });
});
