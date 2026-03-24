import { App, Modal } from 'obsidian';

export class DeleteConfirmModal extends Modal {
  private readonly title: string;
  private readonly onConfirm: () => void;

  constructor(app: App, title: string, onConfirm: () => void) {
    super(app);
    this.title = title;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('curraint-delete-confirm-modal');

    contentEl.createEl('p', {
      text: `Delete "${this.title}"?`,
      cls: 'curraint-delete-confirm-modal__message',
    });

    const actions = contentEl.createEl('div', { cls: 'curraint-delete-confirm-modal__actions' });

    const cancelBtn = actions.createEl('button', {
      text: 'Cancel',
      cls: 'curraint-delete-confirm-modal__cancel',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = actions.createEl('button', {
      text: 'Delete',
      cls: 'mod-warning curraint-delete-confirm-modal__confirm',
    });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });

    // Focus cancel by default so Enter does not accidentally confirm.
    cancelBtn.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
