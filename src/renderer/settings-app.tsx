import { FormEvent, useEffect, useState } from 'react';
import type { EndpointSettings } from '../common/types';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';

type FormState = EndpointSettings;

export function SettingsApp(): React.JSX.Element {
  const [form, setForm] = useState<FormState>({
    apiKey: '',
    baseUrl: '',
    model: '',
    systemPrompt: ''
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    window.flowai
      .getSettings()
      .then((settings) => {
        setForm(settings);
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Failed to load settings');
      });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus('Saving...');

    try {
      await window.flowai.saveSettings({
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        systemPrompt: form.systemPrompt.trim()
      });
      setStatus('Saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save settings');
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
              onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">API Base URL</label>
            <Input
              type="url"
              value={form.baseUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Model</label>
            <Input
              value={form.model}
              onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">System Prompt</label>
            <Textarea
              value={form.systemPrompt}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))
              }
              className="min-h-[96px]"
            />
          </div>

          <div className="flex items-end justify-between gap-2">
            <p className="max-h-16 min-h-4 flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-xs leading-relaxed text-muted-foreground">
              {status}
            </p>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
