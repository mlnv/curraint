import { Plugin, Platform } from 'obsidian';
import { CurraintSettingTab } from './settings-tab';
import { ChatView, CHAT_VIEW_TYPE } from './chat/chat-view';
import type { PluginSettings } from './types';
import { PROVIDER_CONFIGS } from '@curraint/core';
import {
  type SecretsStrategy,
  createSecretsStrategy,
  generateMobileDeviceKey,
} from './secrets';

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  provider: 'openai',
  apiKeyEncrypted: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false,
  mobileDeviceKey: '',
};

export default class CurraintPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
  secrets!: SecretsStrategy;

  async onload(): Promise<void> {
    await this.loadSettings();

    if (Platform.isMobile) {
      // Generate a device key on first mobile run - used by MobileSecretsStrategy.
      if (!this.settings.mobileDeviceKey) {
        this.settings.mobileDeviceKey = generateMobileDeviceKey();
        await this.saveSettings();
      }
      // LM Studio requires a local server, which is not reachable from mobile.
      // Reset to OpenAI if the provider was synced from a desktop vault.
      if (this.settings.provider === 'lmstudio') {
        this.settings.provider = 'openai';
        this.settings.baseUrl = PROVIDER_CONFIGS.openai.defaultBaseUrl;
        await this.saveSettings();
      }
    }

    this.secrets = createSecretsStrategy(
      Platform.isMobile,
      Platform.isMobile ? this.settings.mobileDeviceKey : undefined
    );

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
    for (const leaf of this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)) {
      if (leaf.view instanceof ChatView) {
        leaf.view.destroyRegistry();
      }
    }
    this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_PLUGIN_SETTINGS,
      ...(await this.loadData()),
    };
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
      leaf.view.injectCurrentNote();
    }
  }
}
