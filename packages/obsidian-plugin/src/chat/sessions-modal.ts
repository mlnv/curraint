import { App, Modal } from 'obsidian';
import { listSessions, getSession, deleteSession } from '@curraint/core';
import type { SavedSession, SessionSummary } from '@curraint/core';

function relativeDate(updatedAt: number): string {
  const diff = Math.floor((Date.now() - updatedAt) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export class SessionsModal extends Modal {
  private readonly onLoad: (session: SavedSession) => void;

  constructor(app: App, onLoad: (session: SavedSession) => void) {
    super(app);
    this.onLoad = onLoad;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('curraint-sessions-modal');
    contentEl.createEl('h2', { text: 'Saved conversations' });

    const sessions = listSessions();

    if (sessions.length === 0) {
      contentEl.createEl('p', {
        text: 'No saved conversations yet. Enable "Save sessions" in settings to start saving.',
        cls: 'curraint-sessions-modal__empty',
      });
      return;
    }

    const list = contentEl.createEl('ul', { cls: 'curraint-sessions-modal__list' });
    for (const summary of sessions) {
      this.renderItem(list, summary);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderItem(list: HTMLElement, summary: SessionSummary): void {
    const item = list.createEl('li', { cls: 'curraint-sessions-modal__item' });

    const meta = item.createEl('div', { cls: 'curraint-sessions-modal__meta' });
    meta.createEl('span', {
      text: summary.title || 'Untitled',
      cls: 'curraint-sessions-modal__title',
    });
    meta.createEl('span', {
      text: `${summary.messageCount} messages \u00b7 ${relativeDate(summary.updatedAt)}`,
      cls: 'curraint-sessions-modal__info',
    });

    const actions = item.createEl('div', { cls: 'curraint-sessions-modal__actions' });

    const openBtn = actions.createEl('button', {
      text: 'Open',
      cls: 'mod-cta curraint-sessions-modal__open',
    });
    openBtn.addEventListener('click', () => {
      const session = getSession(summary.id);
      if (session) {
        this.onLoad(session);
      }
      this.close();
    });

    const deleteBtn = actions.createEl('button', {
      text: 'Delete',
      cls: 'curraint-sessions-modal__delete',
    });
    deleteBtn.addEventListener('click', () => {
      deleteSession(summary.id);
      item.remove();
      // Show empty state if the list is now empty
      if (list.children.length === 0) {
        list.replaceWith(
          createEl('p', {
            text: 'No saved conversations yet.',
            cls: 'curraint-sessions-modal__empty',
          })
        );
      }
    });
  }
}
