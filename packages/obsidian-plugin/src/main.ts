import { Plugin } from 'obsidian';
import { CurraintSettingTab } from './settings-tab';
import { ChatView, CHAT_VIEW_TYPE } from './chat/chat-view';
import type { PluginSettings } from './types';

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  provider: 'openai',
  apiKeyEncrypted: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false,
};

export default class CurraintPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));

    this.addRibbonIcon('message-circle', 'Open Curraint Chat', () => {
      this.activateChatView();
    });

    this.addCommand({
      id: 'open-chat',
      name: 'Open chat',
      callback: () => this.activateChatView(),
    });

    this.addCommand({
      id: 'open-chat-with-note',
      name: 'Open chat with current note as context',
      callback: () => this.activateChatView({ injectNote: true }),
    });

    this.addSettingTab(new CurraintSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_PLUGIN_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateChatView(options?: { injectNote?: boolean }): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);

    if (options?.injectNote && leaf.view instanceof ChatView) {
      await (leaf.view as ChatView).injectCurrentNote();
    }
  }
}
