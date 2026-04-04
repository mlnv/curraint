import { App, Component, MarkdownRenderer } from 'obsidian';
import type { ChatMessage } from '@curraint/core';

type StoredMessage = { role: ChatMessage['role']; content: string; noteNames?: string[] };

export class MessageRenderer {
  private readonly container: HTMLElement;
  private readonly app: App;
  private readonly component: Component;
  private activeContentEl: HTMLElement | null = null;
  private activeRawContent = '';
  private plainMode = false;
  private storedMessages: StoredMessage[] = [];

  constructor(container: HTMLElement, app: App, component: Component) {
    this.container = container;
    this.app = app;
    this.component = component;
  }

  get isPlainMode(): boolean {
    return this.plainMode;
  }

  setPlainMode(plain: boolean): void {
    if (this.plainMode === plain) return;
    this.plainMode = plain;
    this.rerender();
  }

  renderAll(messages: ChatMessage[]): void {
    this.storedMessages = [];
    this.container.innerHTML = '';
    this.activeContentEl = null;
    this.activeRawContent = '';
    for (const msg of messages) {
      if (msg.role !== 'system') {
        this.appendMessage(msg.role, msg.content);
      }
    }
  }

  appendMessage(role: ChatMessage['role'], content: string, noteNames?: string[]): HTMLElement {
    this.storedMessages.push({ role, content, noteNames });
    return this.renderMessage(role, content, noteNames);
  }

  beginAssistantMessage(initialContent = ''): void {
    const wrapper = document.createElement('div');
    wrapper.className =
      'curraint-message curraint-message--assistant curraint-message--streaming';
    const contentEl = document.createElement('div');
    contentEl.className = 'curraint-message__content';
    wrapper.appendChild(contentEl);
    this.container.appendChild(wrapper);
    this.activeContentEl = contentEl;
    this.activeRawContent = initialContent;
    if (initialContent) {
      contentEl.textContent = initialContent;
    }
    this.scrollToBottom();
  }

  appendDelta(delta: string): void {
    if (!this.activeContentEl) return;
    this.activeRawContent += delta;
    this.activeContentEl.textContent = this.activeRawContent;
    this.scrollToBottom();
  }

  finalizeAssistantMessage(): void {
    if (!this.activeContentEl) return;
    const el = this.activeContentEl;
    const raw = this.activeRawContent;
    el.closest('.curraint-message--streaming')
      ?.classList.remove('curraint-message--streaming');
    this.storedMessages.push({ role: 'assistant', content: raw });
    if (this.plainMode) {
      el.textContent = raw;
    } else {
      el.textContent = '';
      this.renderMarkdown(raw, el);
    }
    this.activeContentEl = null;
    this.activeRawContent = '';
  }

  /**
   * Called when Stop is pressed. If partial content was already streamed,
   * finalize it so it stays visible. If nothing was received yet (e.g. LM
   * Studio which does not stream), remove the empty bubble entirely.
   */
  cancelAssistantMessage(): void {
    if (!this.activeContentEl) return;
    if (this.activeRawContent.trim()) {
      this.finalizeAssistantMessage();
      return;
    }
    this.activeContentEl.closest('.curraint-message')?.remove();
    this.activeContentEl = null;
    this.activeRawContent = '';
  }

  showError(message: string): void {
    const el = document.createElement('div');
    el.className = 'curraint-message curraint-message--error';
    el.textContent = message;
    this.container.appendChild(el);
    this.scrollToBottom();
  }

  private renderMessage(role: ChatMessage['role'], content: string, noteNames?: string[]): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `curraint-message curraint-message--${role}`;
    const contentEl = document.createElement('div');
    contentEl.className = 'curraint-message__content';
    if (role === 'assistant' && !this.plainMode) {
      this.renderMarkdown(content, contentEl);
    } else {
      contentEl.textContent = content;
    }
    wrapper.appendChild(contentEl);
    if (role === 'user' && noteNames && noteNames.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'curraint-message__note-tags';
      for (const name of noteNames) {
        const tag = document.createElement('span');
        tag.className = 'curraint-message__note-tag';
        tag.textContent = name;
        tagsEl.appendChild(tag);
      }
      wrapper.appendChild(tagsEl);
    }
    this.container.appendChild(wrapper);
    this.scrollToBottom();
    return wrapper;
  }

  private rerender(): void {
    const stored = this.storedMessages.slice();
    const activeRaw = this.activeContentEl ? this.activeRawContent : null;
    this.container.innerHTML = '';
    this.activeContentEl = null;
    this.storedMessages = [];
    for (const msg of stored) {
      this.appendMessage(msg.role, msg.content, msg.noteNames);
    }
    if (activeRaw !== null) {
      this.beginAssistantMessage(activeRaw);
    }
  }

  private scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }

  private renderMarkdown(raw: string, el: HTMLElement): void {
    MarkdownRenderer.render(this.app, raw, el, '', this.component).catch((error: unknown) => {
      console.error('Curraint: Failed to render markdown.', error);
    });
  }
}
