import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { PROVIDER_OPTIONS, testConnection } from '@curraint/core';
import type CurraintPlugin from './main';
import { encryptApiKey, decryptApiKey } from './secrets';
import { testLmStudioConnection } from './transport';

export class CurraintSettingTab extends PluginSettingTab {
  plugin: CurraintPlugin;

  constructor(app: App, plugin: CurraintPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Provider')
      .setDesc('AI provider to use for chat completions.')
      .addDropdown((drop) => {
        for (const p of PROVIDER_OPTIONS) {
          drop.addOption(p.id, p.label);
        }
        drop.setValue(this.plugin.settings.provider);
        drop.onChange(async (value) => {
          const newProvider = value as typeof this.plugin.settings.provider;
          const config = PROVIDER_OPTIONS.find((p) => p.id === newProvider);
          this.plugin.settings.provider = newProvider;
          this.plugin.settings.baseUrl = config?.defaultBaseUrl ?? '';
          this.plugin.settings.model = config?.defaultModel ?? '';
          await this.plugin.saveSettings();
          this.display();
        });
      });

    const selectedProvider = PROVIDER_OPTIONS.find(
      (p) => p.id === this.plugin.settings.provider
    );

    if (selectedProvider?.requiresBaseUrl) {
      new Setting(containerEl)
        .setName('Base URL')
        .setDesc('API base URL for the provider.')
        .addText((text) =>
          text
            .setPlaceholder(selectedProvider.defaultBaseUrl)
            .setValue(this.plugin.settings.baseUrl)
            .onChange(async (value) => {
              this.plugin.settings.baseUrl = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Model name to use for completions.')
      .addText((text) =>
        text
          .setPlaceholder(selectedProvider?.defaultModel ?? 'gpt-4o-mini')
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim();
            await this.plugin.saveSettings();
          })
      );

    if (selectedProvider?.requiresApiKey) {
      new Setting(containerEl)
        .setName('API key')
        .setDesc(
          'Your API key. Stored encrypted using your OS credentials — never synced in plain text.'
        )
        .addText((text) => {
          text.inputEl.type = 'password';
          text
            .setPlaceholder('sk-...')
            .setValue(
              this.plugin.settings.apiKeyEncrypted
                ? decryptApiKey(this.plugin.settings.apiKeyEncrypted)
                : ''
            )
            .onChange(async (value) => {
              this.plugin.settings.apiKeyEncrypted = value
                ? encryptApiKey(value.trim())
                : '';
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(containerEl)
      .setName('System prompt')
      .setDesc('Default system prompt prepended to every conversation.')
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName('Context limits').setHeading();

    new Setting(containerEl)
      .setName('Max messages')
      .setDesc('Maximum number of messages kept in context (4-120).')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.contextMaxMessages))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 4 && num <= 120) {
              this.plugin.settings.contextMaxMessages = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Max characters')
      .setDesc('Maximum total characters kept in context (4000-200000).')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.contextMaxCharacters))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 4000 && num <= 200000) {
              this.plugin.settings.contextMaxCharacters = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl).setName('Sessions').setHeading();

    new Setting(containerEl)
      .setName('Save sessions')
      .setDesc(
        'Persist conversations so you can resume them later. ' +
        'Sessions are stored in the same location as the CLI and desktop app.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSessionSaving)
          .onChange(async (value) => {
            this.plugin.settings.enableSessionSaving = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Test connection')
      .setDesc('Verify the current provider settings can reach the API.')
      .addButton((btn) =>
        btn.setButtonText('Test').onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText('Testing...');
          try {
            const apiKey = this.plugin.settings.apiKeyEncrypted
              ? decryptApiKey(this.plugin.settings.apiKeyEncrypted)
              : '';
            const endpointSettings = {
              provider: this.plugin.settings.provider,
              apiKey,
              baseUrl: this.plugin.settings.baseUrl,
              model: this.plugin.settings.model,
              systemPrompt: this.plugin.settings.systemPrompt,
              contextMaxMessages: this.plugin.settings.contextMaxMessages,
              contextMaxCharacters: this.plugin.settings.contextMaxCharacters,
              enableSessionSaving: this.plugin.settings.enableSessionSaving,
            };
            const message = this.plugin.settings.provider === 'lmstudio'
              ? await testLmStudioConnection(endpointSettings)
              : await testConnection(endpointSettings);
            new Notice(message);
          } catch (err) {
            new Notice(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText('Test');
          }
        })
      );
  }
}
