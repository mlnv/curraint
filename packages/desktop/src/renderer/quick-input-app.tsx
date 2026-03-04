import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { applyTheme } from './lib/theme';

export function QuickInputApp(): React.JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply the saved theme on mount
  useEffect(() => {
    window.curraint
      .getSettings()
      .then((settings) => {
        if (!settings) return;
        applyTheme(settings.theme);
      })
      .catch(() => {/* keep default */});
  }, []);

  // Live-update theme when settings are saved from the settings window
  useEffect(() => {
    return window.curraint.onSettingsChanged((settings) => {
      if (!settings) return;
      applyTheme(settings.theme);
    });
  }, []);

  // Every time the window is brought to front, focus the field
  useEffect(() => {
    const onFocus = (): void => {
      inputRef.current?.focus();
    };
    window.addEventListener('focus', onFocus);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    await window.curraint.submitQuickInput(trimmed);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      setValue('');
      void window.curraint.closeQuickInput();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-2">
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        {/* Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-base font-medium text-foreground placeholder-muted-foreground outline-none"
        />

        {/* Send hint when text present */}
        {value.trim() && (
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ↵
          </kbd>
        )}
      </form>
    </div>
  );
}
