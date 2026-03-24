import { setIcon } from 'obsidian';
import type { TFile } from 'obsidian';

export type InputBarCallbacks = {
  onSubmit: (text: string) => void;
  onAddCurrentNote: () => void;
  onNoteAdd: () => void;
  onNoteRemove: (path: string) => void;
  onStop: () => void;
};

export class InputBar {
  private readonly textarea: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly addCurrentNoteButton: HTMLButtonElement;
  private readonly noteAddButton: HTMLButtonElement;
  private readonly contextBar: HTMLElement;
  private readonly noteChipMap = new Map<string, HTMLElement>();
  private callbacks: InputBarCallbacks;

  constructor(container: HTMLElement, callbacks: InputBarCallbacks) {
    this.callbacks = callbacks;

    const wrapper = document.createElement('div');
    wrapper.className = 'curraint-input-wrapper';

    // Top bar - quick-add current note button (always leftmost) + chips
    this.contextBar = document.createElement('div');
    this.contextBar.className = 'curraint-context-bar';

    this.addCurrentNoteButton = this.createButton(
      'curraint-input-bar__add-current-note',
      '+ Note',
      'Add current note to context'
    );
    this.addCurrentNoteButton.addEventListener('click', () => {
      callbacks.onAddCurrentNote();
    });
    this.contextBar.appendChild(this.addCurrentNoteButton);


    // Main input row
    const bar = document.createElement('div');
    bar.className = 'curraint-input-bar';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'curraint-input-bar__textarea';
    this.textarea.placeholder =
      'Ask anything\u2026 (Enter to send, Shift+Enter for newline)';
    this.textarea.rows = 1;
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.trySubmit(callbacks.onSubmit);
      }
    });
    this.textarea.addEventListener('input', () => this.autoResize());

    this.sendButton = this.createButton(
      'curraint-input-bar__send',
      '\u2191',
      'Send message'
    );
    this.sendButton.addEventListener('click', () =>
      this.trySubmit(callbacks.onSubmit)
    );

    this.stopButton = this.createButton(
      'curraint-input-bar__stop',
      '',
      'Stop response'
    );
    setIcon(this.stopButton, 'square');
    this.stopButton.style.display = 'none';
    this.stopButton.addEventListener('click', () => callbacks.onStop());

    bar.appendChild(this.textarea);
    bar.appendChild(this.sendButton);
    bar.appendChild(this.stopButton);

    // Bottom bar - browse-and-add-notes button
    const bottomBar = document.createElement('div');
    bottomBar.className = 'curraint-input-bottom-bar';

    this.noteAddButton = this.createButton(
      'curraint-input-bar__note-add',
      '+ Add notes',
      'Browse and add notes to context'
    );
    this.noteAddButton.addEventListener('click', () => {
      callbacks.onNoteAdd();
    });
    bottomBar.appendChild(this.noteAddButton);

    wrapper.appendChild(this.contextBar);
    wrapper.appendChild(bar);
    wrapper.appendChild(bottomBar);
    container.appendChild(wrapper);
  }

  /** Update the label on the quick-add button to reflect the active note title. */
  setCurrentNoteTitle(title: string | null): void {
    this.addCurrentNoteButton.textContent = title ? `+ ${title}` : '+ Note';
    this.addCurrentNoteButton.title = title
      ? `Add "${title}" to context`
      : 'Add current note to context';
  }

  setLoading(loading: boolean): void {
    this.textarea.disabled = loading;
    this.addCurrentNoteButton.disabled = loading;
    this.noteAddButton.disabled = loading;
    this.sendButton.style.display = loading ? 'none' : '';
    this.stopButton.style.display = loading ? '' : 'none';
  }

  /** Replace the full set of note chips with the given files. */
  setNoteChips(files: TFile[]): void {
    // Remove chips that are no longer in the list.
    for (const [path, el] of this.noteChipMap) {
      if (!files.some((f) => f.path === path)) {
        el.remove();
        this.noteChipMap.delete(path);
      }
    }
    // Add chips for newly selected files (preserve existing ones).
    for (const file of files) {
      if (!this.noteChipMap.has(file.path)) {
        const chip = this.createChip(file);
        this.contextBar.appendChild(chip);
        this.noteChipMap.set(file.path, chip);
      }
    }
  }

  /** Remove a single chip by file path. */
  removeOneChip(path: string): void {
    const el = this.noteChipMap.get(path);
    if (el) {
      el.remove();
      this.noteChipMap.delete(path);
    }
  }

  /** Remove all chips (e.g. after a message is sent). */
  clearNoteChips(): void {
    for (const el of this.noteChipMap.values()) el.remove();
    this.noteChipMap.clear();
  }

  /** Returns paths of all currently displayed chips. */
  getSelectedPaths(): string[] {
    return Array.from(this.noteChipMap.keys());
  }

  focus(): void {
    this.textarea.focus();
  }

  private createChip(file: TFile): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'curraint-note-chip';

    const icon = document.createElement('span');
    icon.className = 'curraint-note-chip__icon';
    icon.textContent = '\uD83D\uDCC4';

    const label = document.createElement('span');
    label.className = 'curraint-note-chip__label';
    label.textContent = file.basename;

    const remove = document.createElement('button');
    remove.className = 'curraint-note-chip__remove';
    remove.textContent = '\u00D7';
    remove.title = 'Remove note from context';
    remove.addEventListener('click', () => {
      this.removeOneChip(file.path);
      this.callbacks.onNoteRemove(file.path);
    });

    chip.appendChild(icon);
    chip.appendChild(label);
    chip.appendChild(remove);
    return chip;
  }

  private trySubmit(onSubmit: (text: string) => void): void {
    const text = this.textarea.value.trim();
    if (!text) return;
    this.textarea.value = '';
    this.autoResize();
    onSubmit(text);
  }

  private autoResize(): void {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = `${this.textarea.scrollHeight}px`;
  }

  private createButton(
    cls: string,
    text: string,
    title: string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    btn.title = title;
    return btn;
  }
}

