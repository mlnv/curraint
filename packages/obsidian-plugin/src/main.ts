import { Plugin, Platform } from 'obsidian';
import { CurraintSettingTab } from './settings-tab';
import { ChatView, CHAT_VIEW_TYPE } from './chat/chat-view';
import type { PluginSettings, PluginProfile } from './types';
import { PROVIDER_CONFIGS } from '@curraint/core';
import {
  type SecretsStrategy,
  createSecretsStrategy,
  generateMobileDeviceKey,
} from './secrets';

const DEFAULT_PROFILE: PluginProfile = {
  id: 'default',
  name: 'Default',
  provider: 'openai',
  apiKeyEncrypted: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false,
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  activeProfileId: 'default',
  profiles: { default: { ...DEFAULT_PROFILE } },
  mobileDeviceKey: '',
};

function migrateLegacySettings(raw: Record<string, unknown>): PluginSettings | null {
  if (typeof raw['activeProfileId'] === 'string' && typeof raw['profiles'] === 'object') {
    return null;
  }

  const provider = (raw['provider'] as string) ?? 'openai';
  const validProvider = (PROVIDER_CONFIGS as Record<string, unknown>)[provider]
    ? (provider as PluginProfile['provider'])
    : 'openai';

  const profile: PluginProfile = {
    id: 'default',
    name: 'Default',
    provider: validProvider,
    apiKeyEncrypted: (raw['apiKeyEncrypted'] as string) ?? '',
    baseUrl: (raw['baseUrl'] as string) || undefined,
    model: (raw['model'] as string) || undefined,
    systemPrompt: (raw['systemPrompt'] as string) || undefined,
    contextMaxMessages: typeof raw['contextMaxMessages'] === 'number' ? raw['contextMaxMessages'] : undefined,
    contextMaxCharacters: typeof raw['contextMaxCharacters'] === 'number' ? raw['contextMaxCharacters'] : undefined,
    enableSessionSaving: typeof raw['enableSessionSaving'] === 'boolean' ? raw['enableSessionSaving'] : undefined,
  };

  return {
    activeProfileId: 'default',
    profiles: { default: profile },
    mobileDeviceKey: (raw['mobileDeviceKey'] as string) ?? '',
  };
}

export default class CurraintPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
  secrets!: SecretsStrategy;

  async onload(): Promise<void> {
    await this.loadSettings();

    if (Platform.isMobile) {
      let shouldSaveSettings = false;

      if (!this.settings.mobileDeviceKey) {
        this.settings.mobileDeviceKey = generateMobileDeviceKey();
        shouldSaveSettings = true;
      }

      const activeProfile = this.settings.profiles[this.settings.activeProfileId];
      if (activeProfile?.provider === 'lmstudio') {
        activeProfile.provider = 'openai';
        activeProfile.baseUrl = PROVIDER_CONFIGS.openai.defaultBaseUrl;
        shouldSaveSettings = true;
      }

      if (shouldSaveSettings) {
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
      id: 'open-curraint-chat',
      name: 'Open chat',
      callback: () => this.activateChatView(),
    });

    this.addCommand({
      id: 'open-curraint-chat-with-note',
      name: 'Open chat with current note',
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
    const raw = (await this.loadData()) ?? {};
    const migrated = migrateLegacySettings(raw);
    if (migrated) {
      this.settings = migrated;
      await this.saveSettings();
      return;
    }
    this.settings = { ...DEFAULT_PLUGIN_SETTINGS, ...raw } as PluginSettings;
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
