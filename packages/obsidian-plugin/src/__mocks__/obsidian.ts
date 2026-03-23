// Minimal stub for the 'obsidian' module in test environments.
// The real module is provided at runtime by the Obsidian host and is
// marked external in the esbuild config, so it cannot be resolved by vitest.
// Tests that import from 'obsidian' should use vi.mock('obsidian', ...) to
// override specific symbols.

export class MarkdownRenderer {
  static async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: unknown,
  ): Promise<void> {
    el.textContent = markdown;
  }
}

export class Plugin {}
export class ItemView {}
export class Notice {
  constructor(_message: string) {}
}
export class Modal {}
export class Setting {}
export class PluginSettingTab {}
export function setIcon(_el: HTMLElement, _icon: string): void {}
