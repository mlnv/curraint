import { setIcon } from 'obsidian';

export type InputBarCallbacks = {
  onSubmit: (text: string) => void;
  onNoteToggle: (active: boolean) => void;
  onStop: () => void;
};

export class InputBar {
  private readonly textarea: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly noteAddButton: HTMLButtonElement;
  private readonly contextBar: HTMLElement;
  private readonly noteChip: HTMLElement;
  private readonly noteChipLabel: HTMLSpanElement;
  private _noteActive = false;

  constructor(container: HTMLElement, callbacks: InputBarCallbacks) {
    const wrapper = document.createElement('div');
    wrapper.className = 'curraint-input-wrapper';

    // Context bar - always visible; shows note-add button or note chip
    this.contextBar = document.createElement('div');
    this.contextBar.className = 'curraint-context-bar';

    this.noteChip = document.createElement('span');
    this.noteChip.className = 'curraint-note-chip';
    this.noteChip.style.display = 'none';

    const noteChipIcon = document.createElement('span');
    noteChipIcon.className = 'curraint-note-chip__icon';
    noteChipIcon.textContent = '\uD83D\uDCC4';

    this.noteChipLabel = document.createElement('span');
    this.noteChipLabel.className = 'curraint-note-chip__label';
    this.noteChipLabel.textContent = 'Note';

    const noteChipRemove = document.createElement('button');
    noteChipRemove.className = 'curraint-note-chip__remove';
    noteChipRemove.textContent = '\u00D7';
    noteChipRemove.title = 'Remove note from context';
    noteChipRemove.addEventListener('click', () => {
      this.setNoteActive(false);
      callbacks.onNoteToggle(false);
    });

    this.noteChip.appendChild(noteChipIcon);
    this.noteChip.appendChild(this.noteChipLabel);
    this.noteChip.appendChild(noteChipRemove);
    this.contextBar.appendChild(this.noteChip);

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

    this.noteAddButton = this.createButton(
      'curraint-input-bar__note-add',
      '+ Include note',
      'Include current note as context'
    );
    this.noteAddButton.addEventListener('click', () => {
      callbacks.onNoteToggle(true);
    });
    this.contextBar.appendChild(this.noteAddButton);

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

    wrapper.appendChild(this.contextBar);
    wrapper.appendChild(bar);
    container.appendChild(wrapper);
  }

  setLoading(loading: boolean): void {
    this.textarea.disabled = loading;
    this.sendButton.style.display = loading ? 'none' : '';
    this.stopButton.style.display = loading ? '' : 'none';
  }

  setNoteActive(active: boolean, noteName?: string): void {
    this._noteActive = active;
    if (noteName) this.noteChipLabel.textContent = noteName;
    this.noteChip.style.display = active ? '' : 'none';
    this.noteAddButton.style.display = active ? 'none' : '';
    this.noteAddButton.setAttribute('aria-pressed', String(active));
  }

  get isNoteActive(): boolean {
    return this._noteActive;
  }

  focus(): void {
    this.textarea.focus();
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
