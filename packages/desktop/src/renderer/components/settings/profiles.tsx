import { useState } from 'react';
import type { Profile, SettingsFileV2 } from '@curraint/core';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Props = {
  profiles: SettingsFileV2;
  onLoad: (profile: Profile) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
};

export function Profiles({
  profiles,
  onLoad,
  onSave,
  onDelete
}: Props): React.JSX.Element {
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSave = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    onSave(trimmed);
    setName('');
  };

  const entries = Object.values(profiles.profiles);

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-xs font-medium text-muted-foreground">Profiles</p>

      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No profiles yet.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((profile) => (
            <li
              key={profile.id}
              className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{profile.name}</span>
                <span className="ml-1.5 truncate text-[11px] text-muted-foreground">
                  {[profile.model, profile.baseUrl].filter(Boolean).join(' · ') || '(provider defaults)'}
                </span>
                {profile.id === profiles.activeProfileId && (
                  <span className="ml-1.5 text-[10px] text-primary">active</span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 shrink-0 px-2 text-[10px]"
                onClick={() => onLoad(profile)}
              >
                Load
              </Button>
              {confirmDelete === profile.id ? (
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="rounded px-1 text-[10px] text-destructive hover:underline"
                    onClick={() => {
                      onDelete(profile.id);
                      setConfirmDelete(null);
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="rounded px-1 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete ${profile.name}`}
                  className="shrink-0 rounded px-1 text-muted-foreground hover:text-foreground"
                  disabled={profile.id === profiles.activeProfileId || profile.id === 'default'}
                  onClick={() => setConfirmDelete(profile.id)}
                >
                  ✕
                </button>
              )}
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
