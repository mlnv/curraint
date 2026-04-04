import { App, Platform, PluginSettingTab, Setting, Notice } from 'obsidian';
import { PROVIDER_OPTIONS, testConnection } from '@curraint/core';
import type CurraintPlugin from './main';
import { testLmStudioConnection } from './transport';

export class CurraintSettingTab extends PluginSettingTab {
  plugin: CurraintPlugin;
  private apiKeyRequestId = 0;

  constructor(app: App, plugin: CurraintPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    // Pre-decrypt before rendering so the API key field can be populated
    // synchronously inside the Obsidian Settings builder callbacks.
    let decryptedApiKey = '';
    if (this.plugin.settings.apiKeyEncrypted) {
      try {
        decryptedApiKey = await this.plugin.secrets.decrypt(this.plugin.settings.apiKeyEncrypted);
      } catch {
        new Notice('Failed to decrypt the stored API key. Re-enter it to continue.');
      }
    }

    // On mobile, local providers that require a server on the same machine
    // are not reachable. Filter them out so users cannot accidentally select
    // them and get confusing connection errors.
    const providerOptions = Platform.isMobile
      ? PROVIDER_OPTIONS.filter((p) => p.id !== 'lmstudio')
      : PROVIDER_OPTIONS;

    this.renderProviderSection(containerEl, providerOptions, decryptedApiKey);
    this.renderContextLimitsSection(containerEl);
    this.renderSessionsSection(containerEl);
  }

  private renderProviderSection(
    el: HTMLElement,
    providerOptions: typeof PROVIDER_OPTIONS,
    decryptedApiKey: string,
  ): void {
    new Setting(el)
      .setName('Provider')
      .setDesc('AI provider to use for chat completions.')
      .addDropdown((drop) => {
        for (const p of providerOptions) {
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
      new Setting(el)
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

    new Setting(el)
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
      new Setting(el)
        .setName('API key')
        .setDesc(
          'Your API key. Stored encrypted - never synced in plain text.'
        )
        .addText((text) => {
          text.inputEl.type = 'password';
          text
            .setPlaceholder('sk-...')
            .setValue(decryptedApiKey)
            .onChange(async (value) => {
              const requestId = ++this.apiKeyRequestId;
              const encrypted = value
                ? await this.plugin.secrets.encrypt(value.trim())
                : '';
              if (requestId !== this.apiKeyRequestId) return;
              this.plugin.settings.apiKeyEncrypted = encrypted;
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(el)
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
  }

  private renderContextLimitsSection(el: HTMLElement): void {
    new Setting(el).setName('Context limits').setHeading();

    new Setting(el)
      .setName('Max messages')
      .setDesc('Maximum number of messages kept in context (4-120).')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.contextMaxMessages))
          .onChange(async (value) => {
            const previousValue = this.plugin.settings.contextMaxMessages;
            if (value === String(previousValue)) return;
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num) || num < 4 || num > 120) {
              new Notice('Max messages must be between 4 and 120.');
              text.setValue(String(previousValue));
              return;
            }
            this.plugin.settings.contextMaxMessages = num;
            await this.plugin.saveSettings();
          })
      );

    new Setting(el)
      .setName('Max characters')
      .setDesc('Maximum total characters kept in context (4000-200000).')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.contextMaxCharacters))
          .onChange(async (value) => {
            const previousValue = this.plugin.settings.contextMaxCharacters;
            if (value === String(previousValue)) return;
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num) || num < 4000 || num > 200000) {
              new Notice('Max characters must be between 4000 and 200000.');
              text.setValue(String(previousValue));
              return;
            }
            this.plugin.settings.contextMaxCharacters = num;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderSessionsSection(el: HTMLElement): void {
    new Setting(el).setName('Sessions').setHeading();

    new Setting(el)
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

    new Setting(el)
      .setName('Test connection')
      .setDesc('Verify the current provider settings can reach the API.')
      .addButton((btn) =>
        btn.setButtonText('Test').onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText('Testing...');
          try {
            const apiKey = this.plugin.settings.apiKeyEncrypted
              ? await this.plugin.secrets.decrypt(this.plugin.settings.apiKeyEncrypted)
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
            const message =
              this.plugin.settings.provider === 'lmstudio' && !Platform.isMobile
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
