import { app, Menu, type MenuItemConstructorOptions, Tray } from 'electron';
import { createTrayIcon } from './trayIcon';

type TrayManagerOptions = {
  onToggleChat: () => void;
  onOpenSettings: () => void;
};

export class TrayManager {
  private tray: Tray | null = null;
  private unreadCount = 0;

  constructor(private readonly options: TrayManagerOptions) {}

  create(): void {
    this.tray = new Tray(createTrayIcon(false));
    this.applyTooltipAndIcon();

    const template: MenuItemConstructorOptions[] = [
      { label: 'Open Chat', click: this.options.onToggleChat },
      { label: 'Settings', click: this.options.onOpenSettings },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
    this.tray.on('click', this.options.onToggleChat);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  getTray(): Tray | null {
    return this.tray;
  }

  markUnreadMessage(): void {
    this.unreadCount += 1;
    this.applyTooltipAndIcon();
  }

  clearUnreadMessages(): void {
    if (this.unreadCount === 0) {
      this.applyTooltipAndIcon();
      return;
    }

    this.unreadCount = 0;
    this.applyTooltipAndIcon();
  }

  private applyTooltipAndIcon(): void {
    if (!this.tray) {
      return;
    }

    const hasUnread = this.unreadCount > 0;
    this.tray.setImage(createTrayIcon(hasUnread));
    this.tray.setToolTip(hasUnread ? `CurrAInt (${this.unreadCount} new)` : 'CurrAInt');
  }
}
