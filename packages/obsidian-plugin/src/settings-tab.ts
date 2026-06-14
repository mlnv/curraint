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

    const profile = this.plugin.settings.profiles[this.plugin.settings.activeProfileId];

    // Pre-decrypt before rendering so the API key field can be populated
    // synchronously inside the Obsidian Settings builder callbacks.
    let decryptedApiKey = '';
    if (profile?.apiKeyEncrypted) {
      try {
        decryptedApiKey = await this.plugin.secrets.decrypt(profile.apiKeyEncrypted);
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

    this.renderProfileSelector(containerEl);
    this.renderProviderSection(containerEl, providerOptions, decryptedApiKey, profile);
    this.renderContextLimitsSection(containerEl);
    this.renderSessionsSection(containerEl);
  }

  private renderProfileSelector(el: HTMLElement): void {
    const profiles = this.plugin.settings.profiles;
    const activeId = this.plugin.settings.activeProfileId;
    const entries = Object.values(profiles);

    if (entries.length <= 1) return;

    new Setting(el)
      .setName('Active profile')
      .setDesc('Select the profile to use for chat.')
      .addDropdown((drop) => {
        for (const p of entries) {
          drop.addOption(p.id, p.name);
        }
        drop.setValue(activeId);
        drop.onChange(async (value) => {
          this.plugin.settings.activeProfileId = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });
  }

  private activeProfile(): NonNullable<typeof this.plugin.settings.profiles[string]> {
    return (
      this.plugin.settings.profiles[this.plugin.settings.activeProfileId] ??
      (() => {
        this.plugin.settings.profiles.default = {
          id: 'default', name: 'Default', provider: 'openai',
          apiKeyEncrypted: '', baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          systemPrompt: 'You are a helpful assistant.',
          contextMaxMessages: 40, contextMaxCharacters: 24000,
          enableSessionSaving: false,
        };
        this.plugin.settings.activeProfileId = 'default';
        return this.plugin.settings.profiles.default!;
      })()
    );
  }

  private renderProviderSection(
    el: HTMLElement,
    providerOptions: typeof PROVIDER_OPTIONS,
    decryptedApiKey: string,
  ): void {
    const profile = this.activeProfile();
    new Setting(el)
      .setName('Provider')
      .setDesc('AI provider to use for chat completions.')
      .addDropdown((drop) => {
        for (const p of providerOptions) {
          drop.addOption(p.id, p.label);
        }
        drop.setValue(profile.provider);
        drop.onChange(async (value) => {
          const newProvider = value as typeof profile.provider;
          const config = PROVIDER_OPTIONS.find((p) => p.id === newProvider);
          profile.provider = newProvider;
          profile.baseUrl = config?.defaultBaseUrl ?? '';
          profile.model = config?.defaultModel ?? '';
          await this.plugin.saveSettings();
          this.display();
        });
      });

    const selectedProvider = PROVIDER_OPTIONS.find(
      (p) => p.id === profile.provider
    );

    if (selectedProvider?.requiresBaseUrl) {
      new Setting(el)
        .setName('Base URL')
        .setDesc('API base URL for the provider.')
        .addText((text) =>
          text
            .setPlaceholder(selectedProvider.defaultBaseUrl)
            .setValue(profile.baseUrl ?? '')
            .onChange(async (value) => {
              profile.baseUrl = value.trim();
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
          .setValue(profile.model ?? '')
          .onChange(async (value) => {
            profile.model = value.trim();
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
              profile.apiKeyEncrypted = encrypted;
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(el)
      .setName('System prompt')
      .setDesc('Default system prompt prepended to every conversation.')
      .addTextArea((text) =>
        text
          .setValue(profile.systemPrompt ?? '')
          .onChange(async (value) => {
            profile.systemPrompt = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderContextLimitsSection(el: HTMLElement): void {
    const profile = this.activeProfile();
    new Setting(el).setName('Context limits').setHeading();

    new Setting(el)
      .setName('Max messages')
      .setDesc('Maximum number of messages kept in context (4-120).')
      .addText((text) =>
        text
          .setValue(String(profile.contextMaxMessages ?? 40))
          .onChange(async (value) => {
            const previousValue = profile.contextMaxMessages ?? 40;
            if (value === String(previousValue)) return;
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num) || num < 4 || num > 120) {
              new Notice('Max messages must be between 4 and 120.');
              text.setValue(String(previousValue));
              return;
            }
            profile.contextMaxMessages = num;
            await this.plugin.saveSettings();
          })
      );

    new Setting(el)
      .setName('Max characters')
      .setDesc('Maximum total characters kept in context (4000-200000).')
      .addText((text) =>
        text
          .setValue(String(profile.contextMaxCharacters ?? 24000))
          .onChange(async (value) => {
            const previousValue = profile.contextMaxCharacters ?? 24000;
            if (value === String(previousValue)) return;
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num) || num < 4000 || num > 200000) {
              new Notice('Max characters must be between 4000 and 200000.');
              text.setValue(String(previousValue));
              return;
            }
            profile.contextMaxCharacters = num;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderSessionsSection(el: HTMLElement): void {
    const profile = this.activeProfile();
    new Setting(el).setName('Sessions').setHeading();

    new Setting(el)
      .setName('Save sessions')
      .setDesc(
        'Persist conversations so you can resume them later. ' +
        'Sessions are stored in the same location as the CLI and desktop app.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(profile.enableSessionSaving ?? false)
          .onChange(async (value) => {
            profile.enableSessionSaving = value;
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
            const p = this.activeProfile();
            const apiKey = p.apiKeyEncrypted
              ? await this.plugin.secrets.decrypt(p.apiKeyEncrypted)
              : '';
            const endpointSettings = {
              provider: p.provider,
              apiKey,
              baseUrl: p.baseUrl ?? '',
              model: p.model ?? '',
              systemPrompt: p.systemPrompt ?? '',
              contextMaxMessages: p.contextMaxMessages ?? 40,
              contextMaxCharacters: p.contextMaxCharacters ?? 24000,
              enableSessionSaving: p.enableSessionSaving ?? false,
            };
            const message =
              p.provider === 'lmstudio' && !Platform.isMobile
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
