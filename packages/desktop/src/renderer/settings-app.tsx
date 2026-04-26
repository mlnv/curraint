import { FormEvent, useEffect, useState } from 'react';
import { getProviderConfig } from '@curraint/core';
import type { AppSettings, RuntimeFeatureFlags, SavedConnection } from '@curraint/core';
import { Card } from './components/ui/card';
import { SettingsFormActions } from './components/settings/settings-form-actions';
import { SettingsFormFields } from './components/settings/settings-form-fields';
import { toErrorMessage } from './lib/errors';
import { applyTheme } from './lib/theme';

type FormState = AppSettings;

const EMPTY_FORM: FormState = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  systemPrompt: '',
  enableThinkTagFolding: true,
  enableDebugLogging: false,
  enableSessionSaving: false,
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  savedConnections: [],
  quickInputShortcut: 'CommandOrControl+Shift+A',
  theme: 'black'
};

const DEFAULT_FEATURE_FLAGS: RuntimeFeatureFlags = {
  enableCopilotProvider: false
};

export function SettingsApp(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [featureFlags, setFeatureFlags] = useState<RuntimeFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [shortcutRegistered, setShortcutRegistered] = useState<boolean | undefined>(undefined);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'theme') {
      applyTheme(value as FormState['theme']);
    }
  };

  const updateProvider = (provider: FormState['provider']): void => {
    const nextConfig = getProviderConfig(provider);

    setForm((prev) => ({
      ...prev,
      provider,
      baseUrl: nextConfig.defaultBaseUrl,
      model: nextConfig.defaultModel,
      apiKey: nextConfig.requiresApiKey ? prev.apiKey : ''
    }));
  };

  const loadConnection = (conn: SavedConnection): void => {
    setForm((prev) => ({
      ...prev,
      provider: conn.provider,
      apiKey: conn.apiKey,
      baseUrl: conn.baseUrl,
      model: conn.model
    }));
  };

  const saveConnection = (name: string): void => {
    const newConn: SavedConnection = {
      id: Date.now().toString(36),
      name,
      provider: form.provider,
      apiKey: form.apiKey.trim(),
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim()
    };

    setForm((prev) => ({
      ...prev,
      savedConnections: [...prev.savedConnections, newConn]
    }));
  };

  const deleteConnection = (id: string): void => {
    setForm((prev) => ({
      ...prev,
      savedConnections: prev.savedConnections.filter((c) => c.id !== id)
    }));
  };

  useEffect(() => {
    void window.curraint.getSettings()
      .then((settings) => {
        if (!settings) {
          return;
        }

        setForm(settings);
        applyTheme(settings.theme);
      })
      .catch((error: unknown) => {
        setStatus(toErrorMessage(error, 'Failed to load settings'));
      });

    void window.curraint.getFeatureFlags()
      .then((nextFeatureFlags) => {
        setFeatureFlags(nextFeatureFlags);
      })
      .catch((error: unknown) => {
        setFeatureFlags(DEFAULT_FEATURE_FLAGS);
        setStatus(toErrorMessage(error, 'Failed to load feature flags'));
      });
  }, []);

  useEffect(() => {
    return window.curraint.onShortcutRegistered((ok) => {
      setShortcutRegistered(ok);
    });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus('Saving...');
    setIsSaving(true);

    try {
      await window.curraint.saveSettings({
        provider: form.provider,
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        systemPrompt: form.systemPrompt.trim(),
        enableThinkTagFolding: form.enableThinkTagFolding,
        enableDebugLogging: form.enableDebugLogging,
        enableSessionSaving: form.enableSessionSaving,
        contextMaxMessages: form.contextMaxMessages,
        contextMaxCharacters: form.contextMaxCharacters,
        savedConnections: form.savedConnections,
        quickInputShortcut: form.quickInputShortcut,
        theme: form.theme
      });
      setStatus('Saved');
      window.close();
    } catch (error) {
      setStatus(toErrorMessage(error, 'Failed to save settings'));
    } finally {
      setIsSaving(false);
    }
  };

  const onTestConnection = async (): Promise<void> => {
    setStatus('Testing connection...');
    setIsTesting(true);

    try {
      const message = await window.curraint.testConnection({
        provider: form.provider,
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        systemPrompt: form.systemPrompt.trim(),
        enableThinkTagFolding: form.enableThinkTagFolding,
        enableDebugLogging: form.enableDebugLogging,
        enableSessionSaving: form.enableSessionSaving,
        contextMaxMessages: form.contextMaxMessages,
        contextMaxCharacters: form.contextMaxCharacters,
        savedConnections: form.savedConnections,
        quickInputShortcut: form.quickInputShortcut,
        theme: form.theme
      });

      setStatus(message);
    } catch (error) {
      setStatus(toErrorMessage(error, 'Connection test failed'));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground">
      <Card className="flex h-full flex-col rounded-none p-4">
        <div className="mb-4 shrink-0">
          <p className="text-sm font-medium">Settings</p>
          <p className="text-xs text-muted-foreground">OpenAI-compatible endpoint</p>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            <SettingsFormFields
              form={form}
              featureFlags={featureFlags}
              shortcutRegistered={shortcutRegistered}
              onProviderChange={updateProvider}
              onFieldChange={updateField}
              onLoadConnection={loadConnection}
              onSaveConnection={saveConnection}
              onDeleteConnection={deleteConnection}
              onOpenLogFolder={() => { void window.curraint.openLogFolder(); }}
            />
          </div>

          <div className="mt-3 shrink-0 border-t pt-3">
            <SettingsFormActions
              status={status}
              isSaving={isSaving}
              isTesting={isTesting}
              onTestConnection={() => {
                void onTestConnection();
              }}
            />
          </div>
        </form>
      </Card>
    </div>
  );
}
