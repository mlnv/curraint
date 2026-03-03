import { getProviderConfig, PROVIDER_OPTIONS } from '../../../common/providers';
import type { EndpointSettings, SavedConnection } from '../../../common/types';
import { THEME_OPTIONS } from '../../lib/theme';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { SavedConnections } from './saved-connections';
import { ShortcutRecorder } from './shortcut-recorder';

type Props = {
  form: EndpointSettings;
  shortcutRegistered: boolean | undefined;
  onProviderChange: (provider: EndpointSettings['provider']) => void;
  onFieldChange: <K extends keyof EndpointSettings>(
    key: K,
    value: EndpointSettings[K]
  ) => void;
  onLoadConnection: (connection: SavedConnection) => void;
  onSaveConnection: (name: string) => void;
  onDeleteConnection: (id: string) => void;
};

export function SettingsFormFields({
  form,
  shortcutRegistered,
  onProviderChange,
  onFieldChange,
  onLoadConnection,
  onSaveConnection,
  onDeleteConnection
}: Props): React.JSX.Element {
  const providerConfig = getProviderConfig(form.provider);

  return (
    <>
      <SavedConnections
        connections={form.savedConnections}
        onLoad={onLoadConnection}
        onSave={onSaveConnection}
        onDelete={onDeleteConnection}
      />

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
            : form.provider === 'copilot'
            ? 'Uses your logged-in GitHub account via the Copilot CLI.'
            : 'Use Custom for any OpenAI-compatible endpoint.'}
        </p>
      </div>

      {form.provider === 'copilot' ? (
        <div className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-xs">Authentication via GitHub Copilot CLI</p>
          <p>Run <code className="rounded bg-muted px-1 py-0.5">gh auth login</code> or <code className="rounded bg-muted px-1 py-0.5">copilot auth login</code> in a terminal to authenticate.</p>
          <p>No API key or base URL is needed in this app.</p>
        </div>
      ) : (
        <>
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
        </>
      )}

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

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Quick Input Shortcut</label>
        <ShortcutRecorder
          value={form.quickInputShortcut}
          onChange={(val) => onFieldChange('quickInputShortcut', val)}
          registered={shortcutRegistered}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Theme</label>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onFieldChange('theme', theme.id)}
              className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                form.theme === theme.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground'
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <details className="rounded-md border p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Advanced context safety
        </summary>
        <div className="mt-2 space-y-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Max messages kept</label>
            <Input
              type="number"
              min={4}
              max={120}
              value={form.contextMaxMessages}
              onChange={(event) =>
                onFieldChange('contextMaxMessages', Number(event.target.value))
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Max characters kept</label>
            <Input
              type="number"
              min={4000}
              max={200000}
              step={1000}
              value={form.contextMaxCharacters}
              onChange={(event) =>
                onFieldChange('contextMaxCharacters', Number(event.target.value))
              }
              required
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Older messages are summarized when these limits are exceeded.
          </p>
        </div>
      </details>
    </>
  );
}
