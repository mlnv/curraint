// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRenderer } from './message-renderer';
import type { App, Component } from 'obsidian';

vi.mock('obsidian', () => ({
  MarkdownRenderer: {
    render: vi.fn(async (_app: unknown, markdown: string, el: HTMLElement) => {
      el.textContent = markdown;
    }),
  },
}));

describe('MessageRenderer', () => {
  let container: HTMLDivElement;
  let renderer: MessageRenderer;
  const mockApp = {} as App;
  const mockComponent = {} as Component;

  beforeEach(() => {
    container = document.createElement('div');
    renderer = new MessageRenderer(container, mockApp, mockComponent);
  });

  it('renders user and assistant messages, skipping system ones', () => {
    renderer.renderAll([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);
    const messages = container.querySelectorAll('.curraint-message');
    expect(messages).toHaveLength(2);
    expect(messages[0].classList.contains('curraint-message--user')).toBe(true);
    expect(messages[1].classList.contains('curraint-message--assistant')).toBe(true);
  });

  it('clears previous content on renderAll', () => {
    renderer.appendMessage('user', 'Old');
    renderer.renderAll([{ role: 'user', content: 'New' }]);
    expect(container.querySelectorAll('.curraint-message')).toHaveLength(1);
    expect(container.querySelector('.curraint-message__content')?.textContent).toBe('New');
  });

  it('appends delta text to the active streaming message', () => {
    renderer.beginAssistantMessage();
    renderer.appendDelta('Hello');
    renderer.appendDelta(' world');
    expect(container.querySelector('.curraint-message__content')?.textContent).toBe('Hello world');
  });

  it('finalizeAssistantMessage removes the streaming class', () => {
    renderer.beginAssistantMessage();
    renderer.appendDelta('Done');
    renderer.finalizeAssistantMessage();
    expect(container.querySelector('.curraint-message--streaming')).toBeNull();
  });

  it('appendDelta is a no-op when no streaming message is active', () => {
    expect(() => renderer.appendDelta('text')).not.toThrow();
  });

  it('showError adds an error element with the message text', () => {
    renderer.showError('Something went wrong');
    const el = container.querySelector('.curraint-message--error');
    expect(el?.textContent).toBe('Something went wrong');
  });

  describe('cancelAssistantMessage', () => {
    it('removes the streaming bubble when no content has been received', () => {
      renderer.beginAssistantMessage();
      expect(container.querySelector('.curraint-message--streaming')).not.toBeNull();

      renderer.cancelAssistantMessage();

      expect(container.querySelector('.curraint-message')).toBeNull();
    });

    it('is a no-op when there is no active streaming message', () => {
      expect(() => renderer.cancelAssistantMessage()).not.toThrow();
      expect(container.querySelectorAll('.curraint-message')).toHaveLength(0);
    });

    it('finalizes instead of removing when partial content was streamed', () => {
      renderer.beginAssistantMessage();
      renderer.appendDelta('Partial response');

      renderer.cancelAssistantMessage();

      const msg = container.querySelector('.curraint-message');
      expect(msg).not.toBeNull();
      expect(msg?.classList.contains('curraint-message--streaming')).toBe(false);
      expect(container.querySelector('.curraint-message__content')?.textContent).toBe('Partial response');
    });

    it('does not add an empty assistant entry to storedMessages when cancelling with no content', () => {
      renderer.appendMessage('user', 'Hello');
      renderer.beginAssistantMessage();
      renderer.cancelAssistantMessage();

      // Re-render - should only show the user message.
      renderer.setPlainMode(false);
      const messages = container.querySelectorAll('.curraint-message');
      expect(messages).toHaveLength(1);
      expect(messages[0]?.classList.contains('curraint-message--user')).toBe(true);
    });
  });

  describe('plain mode', () => {
    it('isPlainMode is false by default', () => {
      expect(renderer.isPlainMode).toBe(false);
    });

    it('in plain mode, assistant messages use textContent instead of MarkdownRenderer', async () => {
      renderer.setPlainMode(true);
      renderer.appendMessage('assistant', '**bold**');
      // Wait for any pending microtasks
      await Promise.resolve();
      const el = container.querySelector('.curraint-message__content');
      expect(el?.textContent).toBe('**bold**');
    });

    it('in plain mode, finalizeAssistantMessage uses textContent', async () => {
      renderer.setPlainMode(true);
      renderer.beginAssistantMessage();
      renderer.appendDelta('# Heading');
      renderer.finalizeAssistantMessage();
      await Promise.resolve();
      const el = container.querySelector('.curraint-message__content');
      expect(el?.textContent).toBe('# Heading');
    });

    it('toggling to plain mode re-renders existing messages as plain text', async () => {
      renderer.appendMessage('assistant', '**bold**');
      await Promise.resolve();
      renderer.setPlainMode(true);
      await Promise.resolve();
      const el = container.querySelector('.curraint-message__content');
      expect(el?.textContent).toBe('**bold**');
    });

    it('toggling back to rendered mode re-renders using MarkdownRenderer', async () => {
      const { MarkdownRenderer } = await import('obsidian');
      const renderSpy = vi.mocked(MarkdownRenderer.render);
      renderSpy.mockClear();

      renderer.setPlainMode(true);
      renderer.appendMessage('assistant', '**bold**');
      renderer.setPlainMode(false);
      await Promise.resolve();

      expect(renderSpy).toHaveBeenCalled();
    });

    it('setPlainMode is a no-op when called with the current value', () => {
      const initialCount = container.children.length;
      renderer.setPlainMode(false);
      expect(container.children.length).toBe(initialCount);
    });
  });
});
