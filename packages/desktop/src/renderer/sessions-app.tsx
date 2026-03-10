import { useEffect, useState } from 'react';
import type { SessionSummary } from '@curraint/core';
import { Card } from './components/ui/card';
import { applyTheme } from './lib/theme';

function formatRelativeDate(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function SessionsApp(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = async (): Promise<void> => {
    try {
      const list = await window.curraint.listSessions();
      setSessions(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    window.curraint
      .getSettings()
      .then((settings) => {
        if (settings) applyTheme(settings.theme);
      })
      .catch(() => undefined);

    void loadSessions();

    // Refresh the list every time the window is brought into focus so it
    // always reflects sessions saved since the window was last opened.
    const onFocus = (): void => { void loadSessions(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const openSession = async (id: string): Promise<void> => {
    await window.curraint.loadSession(id);
    window.close();
  };

  const deleteSession = async (id: string): Promise<void> => {
    setDeletingId(id);
    try {
      await window.curraint.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground">
      <Card className="flex h-full flex-col rounded-none">
        <div className="shrink-0 border-b px-4 py-3">
          <p className="text-sm font-medium">Sessions</p>
          <p className="text-xs text-muted-foreground">Your saved conversations</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">Loading…</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm text-muted-foreground">No saved sessions yet.</p>
              <p className="text-xs text-muted-foreground">
                Enable <em>Save sessions</em> in Settings to start saving conversations.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      title={session.title}
                    >
                      {session.title || '(untitled)'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                      {' · '}
                      {formatRelativeDate(session.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => { void openSession(session.id); }}
                      className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === session.id}
                      onClick={() => { void deleteSession(session.id); }}
                      className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
