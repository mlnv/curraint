import { Button } from '../ui/button';

type Props = {
  status: string;
  isSaving: boolean;
  isTesting: boolean;
  onTestConnection: () => void;
};

export function SettingsFormActions({
  status,
  isSaving,
  isTesting,
  onTestConnection
}: Props): React.JSX.Element {
  return (
    <div className="flex items-end justify-between gap-2">
      <p className="max-h-16 min-h-4 flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-xs leading-relaxed text-muted-foreground">
        {status}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving || isTesting}
          onClick={onTestConnection}
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button type="submit" size="sm" disabled={isSaving || isTesting}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
