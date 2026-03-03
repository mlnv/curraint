import { useState } from 'react';
import type { SavedConnection } from '../../../common/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Props = {
  connections: SavedConnection[];
  onLoad: (connection: SavedConnection) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
};

export function SavedConnections({
  connections,
  onLoad,
  onSave,
  onDelete
}: Props): React.JSX.Element {
  const [name, setName] = useState('');

  const handleSave = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    onSave(trimmed);
    setName('');
  };

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-xs font-medium text-muted-foreground">Saved connections</p>

      {connections.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No saved connections yet.</p>
      ) : (
        <ul className="space-y-1">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{conn.name}</span>
                <span className="ml-1.5 truncate text-[11px] text-muted-foreground">
                  {conn.model} &middot; {conn.baseUrl}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 shrink-0 px-2 text-[10px]"
                onClick={() => onLoad(conn)}
              >
                Load
              </Button>
              <button
                type="button"
                aria-label={`Delete ${conn.name}`}
                className="shrink-0 rounded px-1 text-muted-foreground hover:text-foreground"
                onClick={() => onDelete(conn.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name for current settings..."
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!name.trim()}
          onClick={handleSave}
          className="h-7 shrink-0"
        >
          Save current
        </Button>
      </div>
    </div>
  );
}
