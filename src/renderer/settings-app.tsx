import { FormEvent, useEffect, useState } from 'react';
import type { EndpointSettings } from '../common/types';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { toErrorMessage } from './lib/errors';

type FormState = EndpointSettings;

const EMPTY_FORM: FormState = {
  apiKey: '',
  baseUrl: '',
  model: '',
  systemPrompt: ''
};

export function SettingsApp(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        systemPrompt: form.systemPrompt.trim()
      });
      setStatus('Saved');
    } catch (error) {
      setStatus(toErrorMessage(error, 'Failed to save settings'));
    } finally {
      setIsSaving(false);
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
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">API Key</label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(event) => updateField('apiKey', event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">API Base URL</label>
            <Input
              type="url"
              value={form.baseUrl}
              onChange={(event) => updateField('baseUrl', event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Model</label>
            <Input
              value={form.model}
              onChange={(event) => updateField('model', event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">System Prompt</label>
            <Textarea
              value={form.systemPrompt}
              onChange={(event) => updateField('systemPrompt', event.target.value)}
              className="min-h-[96px]"
            />
          </div>

          <div className="flex items-end justify-between gap-2">
            <p className="max-h-16 min-h-4 flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-xs leading-relaxed text-muted-foreground">
              {status}
            </p>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
