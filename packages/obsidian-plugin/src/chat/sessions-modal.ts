import { App, Modal, Notice, setIcon } from 'obsidian';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { listSessions, getSession, deleteSession, saveSession } from '@curraint/core';
import type { SavedSession, SessionSummary } from '@curraint/core';
import { relativeDate } from './relative-date';

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

    const titleRow = meta.createEl('div', { cls: 'curraint-sessions-modal__title-row' });
    const titleSpan = titleRow.createEl('span', {
      text: summary.title || 'Untitled',
      cls: 'curraint-sessions-modal__title',
    });

    const renameBtn = titleRow.createEl('button', {
      cls: 'curraint-sessions-modal__rename',
      title: 'Rename',
      attr: { 'aria-label': 'Rename conversation' },
    });
    setIcon(renameBtn, 'pencil');

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
        this.close();
        return;
      }
      new Notice('Could not load session.');
    });

    const deleteBtn = actions.createEl('button', {
      text: 'Delete',
      cls: 'curraint-sessions-modal__delete',
    });
    deleteBtn.addEventListener('click', () => {
      new DeleteConfirmModal(this.app, summary.title || 'Untitled', () => {
        deleteSession(summary.id);
        item.remove();
        if (list.children.length === 0) {
          list.replaceWith(
            createEl('p', {
              text: 'No saved conversations yet.',
              cls: 'curraint-sessions-modal__empty',
            })
          );
        }
      }).open();
    });

    renameBtn.addEventListener('click', () => {
      this.beginInlineRename(summary, titleSpan);
    });
  }

  private beginInlineRename(summary: SessionSummary, titleSpan: HTMLElement): void {
    const current = titleSpan.textContent ?? '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'curraint-sessions-modal__rename-input';
    input.value = current;
    titleSpan.replaceWith(input);
    input.select();

    let committed = false;

    const restoreSpan = (text: string): void => {
      const span = createEl('span', { text, cls: 'curraint-sessions-modal__title' });
      input.replaceWith(span);
      const renameBtn = span.parentElement?.querySelector(
        '.curraint-sessions-modal__rename'
      ) as HTMLElement | null;
      renameBtn?.addEventListener('click', () => this.beginInlineRename(summary, span));
    };

    const commit = (): void => {
      if (committed) return;
      committed = true;
      const trimmed = input.value.trim();
      const newTitle = trimmed || current;
      summary.title = newTitle;
      const saved = getSession(summary.id);
      if (saved) {
        saveSession({ ...saved, title: newTitle });
      }
      restoreSpan(newTitle);
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') {
        committed = true;
        restoreSpan(current);
      }
    });
    input.addEventListener('blur', commit);
  }
}

