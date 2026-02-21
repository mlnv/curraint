import { FormEvent, useEffect, useState } from 'react';
import { getProviderConfig } from '../common/providers';
import type { EndpointSettings } from '../common/types';
import { Card } from './components/ui/card';
import { SettingsFormActions } from './components/settings/settings-form-actions';
import { SettingsFormFields } from './components/settings/settings-form-fields';
import { toErrorMessage } from './lib/errors';

type FormState = EndpointSettings;

const EMPTY_FORM: FormState = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  systemPrompt: '',
  enableThinkTagFolding: true,
  contextMaxMessages: 40,
  contextMaxCharacters: 24000
};

export function SettingsApp(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  useEffect(() => {
    window.flowai
      .getSettings()
      .then((settings) => {
        setForm(settings);
      })
      .catch((error: unknown) => {
        setStatus(toErrorMessage(error, 'Failed to load settings'));
      });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus('Saving...');
    setIsSaving(true);

    try {
      await window.flowai.saveSettings({
        provider: form.provider,
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        systemPrompt: form.systemPrompt.trim(),
        enableThinkTagFolding: form.enableThinkTagFolding,
        contextMaxMessages: form.contextMaxMessages,
        contextMaxCharacters: form.contextMaxCharacters
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
      const message = await window.flowai.testConnection({
        provider: form.provider,
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        systemPrompt: form.systemPrompt.trim(),
        enableThinkTagFolding: form.enableThinkTagFolding,
        contextMaxMessages: form.contextMaxMessages,
        contextMaxCharacters: form.contextMaxCharacters
      });

      setStatus(message);
    } catch (error) {
      setStatus(toErrorMessage(error, 'Connection test failed'));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="h-screen bg-background p-3 text-foreground">
      <Card className="h-full p-4">
        <div className="mb-4">
          <p className="text-sm font-medium">Settings</p>
          <p className="text-xs text-muted-foreground">OpenAI-compatible endpoint</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <SettingsFormFields
            form={form}
            onProviderChange={updateProvider}
            onFieldChange={updateField}
          />

          <SettingsFormActions
            status={status}
            isSaving={isSaving}
            isTesting={isTesting}
            onTestConnection={() => {
              void onTestConnection();
            }}
          />
        </form>
      </Card>
    </div>
  );
}
