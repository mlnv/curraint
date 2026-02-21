import { getProviderConfig, PROVIDER_OPTIONS } from '../../../common/providers';
import type { EndpointSettings } from '../../../common/types';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type Props = {
  form: EndpointSettings;
  onProviderChange: (provider: EndpointSettings['provider']) => void;
  onFieldChange: <K extends keyof EndpointSettings>(
    key: K,
    value: EndpointSettings[K]
  ) => void;
};

export function SettingsFormFields({
  form,
  onProviderChange,
  onFieldChange
}: Props): React.JSX.Element {
  const providerConfig = getProviderConfig(form.provider);

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Provider</label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.provider}
          onChange={(event) =>
            onProviderChange(event.target.value as EndpointSettings['provider'])
          }
        >
          {PROVIDER_OPTIONS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          {form.provider === 'lmstudio'
            ? 'LM Studio default: http://127.0.0.1:1234/v1'
            : 'Use Custom for any OpenAI-compatible endpoint.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">API Key</label>
        <Input
          type="password"
          value={form.apiKey}
          onChange={(event) => onFieldChange('apiKey', event.target.value)}
          required={providerConfig.requiresApiKey}
          placeholder={providerConfig.requiresApiKey ? '' : 'Optional for this provider'}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">API Base URL</label>
        <Input
          type="url"
          value={form.baseUrl}
          onChange={(event) => onFieldChange('baseUrl', event.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Model</label>
        <Input
          value={form.model}
          onChange={(event) => onFieldChange('model', event.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">System Prompt</label>
        <Textarea
          value={form.systemPrompt}
          onChange={(event) => onFieldChange('systemPrompt', event.target.value)}
          className="min-h-[96px]"
        />
      </div>

      <label className="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={form.enableThinkTagFolding}
          onChange={(event) => onFieldChange('enableThinkTagFolding', event.target.checked)}
        />
        Hide and collapse &lt;think&gt; / &lt;reasoning&gt; blocks in AI responses
      </label>
    </>
  );
}
