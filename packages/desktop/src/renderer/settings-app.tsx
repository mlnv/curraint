import { FormEvent, useEffect, useState } from 'react';
import { getProviderConfig, DEFAULT_PROFILE_ID } from '@curraint/core';
import type { AppSettings, Profile, SettingsFileV2 } from '@curraint/core';
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
  quickInputShortcut: 'CommandOrControl+Shift+A',
  theme: 'black'
};

export function SettingsApp(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [shortcutRegistered, setShortcutRegistered] = useState<boolean | undefined>(undefined);
  const [profiles, setProfiles] = useState<SettingsFileV2>({
    version: 2,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: {}
  });

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

  const loadProfile = (profile: Profile): void => {
    setForm((prev) => ({
      ...prev,
      provider: profile.provider,
      baseUrl: profile.baseUrl ?? prev.baseUrl,
      model: profile.model ?? prev.model,
      systemPrompt: profile.systemPrompt ?? prev.systemPrompt,
      contextMaxMessages: profile.contextMaxMessages ?? prev.contextMaxMessages,
      contextMaxCharacters: profile.contextMaxCharacters ?? prev.contextMaxCharacters,
      enableSessionSaving: profile.enableSessionSaving ?? prev.enableSessionSaving
    }));
    setProfiles((prev) => ({ ...prev, activeProfileId: profile.id }));
  };

  const saveProfile = (name: string): void => {
    const id = Date.now().toString(36);
    const newProfile: Profile = {
      id,
      name,
      provider: form.provider,
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      systemPrompt: form.systemPrompt.trim(),
      contextMaxMessages: form.contextMaxMessages,
      contextMaxCharacters: form.contextMaxCharacters,
      enableSessionSaving: form.enableSessionSaving
    };
    const prevProfiles = profiles;
    const next: SettingsFileV2 = {
      ...profiles,
      profiles: { ...profiles.profiles, [id]: newProfile }
    };
    setProfiles(next);
    window.curraint.saveProfiles(next).catch((error: unknown) => {
      setProfiles(prevProfiles);
      setStatus(`Failed to save profile: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const deleteProfile = (id: string): void => {
    const { [id]: _, ...remaining } = profiles.profiles;
    const activeProfileId = profiles.activeProfileId === id
      ? DEFAULT_PROFILE_ID
      : profiles.activeProfileId;
    const prevProfiles = profiles;
    const next: SettingsFileV2 = {
      ...profiles,
      activeProfileId,
      profiles: remaining
    };
    setProfiles(next);
    window.curraint.saveProfiles(next).catch((error: unknown) => {
      setProfiles(prevProfiles);
      setStatus(`Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  useEffect(() => {
    window.curraint
      .getSettings()
      .then((settings) => {
        if (!settings) return;
        setForm(settings);
        applyTheme(settings.theme);
      })
      .catch((error: unknown) => {
        setStatus(toErrorMessage(error, 'Failed to load settings'));
      });

    window.curraint
      .getProfiles()
      .then((v2) => {
        if (!v2) return;
        setProfiles(v2);
      })
      .catch(() => {});
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
              shortcutRegistered={shortcutRegistered}
              profiles={profiles}
              onProviderChange={updateProvider}
              onFieldChange={updateField}
              onLoadProfile={loadProfile}
              onSaveProfile={saveProfile}
              onDeleteProfile={deleteProfile}
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
