import type { App, TFile } from 'obsidian';
import type { ChatMessage } from '@curraint/core';

/**
 * Builds a system ChatMessage for the given note file. Returns null when
 * the file content is blank.
 */
export async function buildNoteContextMessageForFile(
  app: App,
  file: TFile
): Promise<ChatMessage | null> {
  const content = await app.vault.read(file);
  if (!content.trim()) return null;

  return {
    role: 'system',
    content: `The user has shared the following note for context. Its title is "${file.basename}".\n\n---\n\n${content}`,
  };
}

/**
 * Reads the currently active note and returns it as a system ChatMessage
 * that can be prepended to the conversation. Returns null when no note is open.
 */
export async function buildNoteContextMessage(app: App): Promise<ChatMessage | null> {
  const file = app.workspace.getActiveFile();
  if (!file) return null;
  return buildNoteContextMessageForFile(app, file);
}
