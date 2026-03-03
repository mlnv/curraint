import { KeyboardEvent, useEffect, useRef, useState } from 'react';

// Maps browser KeyboardEvent.key to Electron accelerator key names.
const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  'Enter': 'Return',
  'Backspace': 'Backspace',
  'Delete': 'Delete',
  'Insert': 'Insert',
  'Home': 'Home',
  'End': 'End',
  'PageUp': 'PageUp',
  'PageDown': 'PageDown',
  'ArrowUp': 'Up',
  'ArrowDown': 'Down',
  'ArrowLeft': 'Left',
  'ArrowRight': 'Right',
  'Tab': 'Tab',
  '+': 'Plus',
  '=': 'Plus',
  '-': '-',
  '.': '.',
  ',': ',',
  ';': ';',
  "'": "'",
  '`': '`',
  '[': '[',
  ']': ']',
  '\\': '\\',
  '/': '/',
};

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'OS']);

function browserKeyToAccelerator(key: string): string | null {
  if (MODIFIER_KEYS.has(key)) {
    return null;
  }

  if (KEY_MAP[key]) {
    return KEY_MAP[key];
  }

  // F1–F24
  if (/^F\d+$/.test(key)) {
    return key;
  }

  // Single printable character — uppercase
  if (key.length === 1) {
    return key.toUpperCase();
  }

  return null;
}

function buildAccelerator(event: KeyboardEvent<HTMLElement>): string | null {
  const key = browserKeyToAccelerator(event.key);
  if (!key) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');
  parts.push(key);

  // Require at least one modifier
  if (parts.length < 2) {
    return null;
  }

  return parts.join('+');
}

// Split an Electron accelerator string into display chips.
function acceleratorToChips(accelerator: string): string[] {
  if (!accelerator.trim()) {
    return [];
  }
  return accelerator.split('+').map((part) => {
    const display: Record<string, string> = {
      Control: 'Ctrl',
      CommandOrControl: 'Ctrl',
      Super: 'Win',
      Return: '↵',
      Space: 'Space',
      Up: '↑',
      Down: '↓',
      Left: '←',
      Right: '→',
      Plus: '+',
    };
    return display[part] ?? part;
  });
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** undefined = not yet known, true = ok, false = failed */
  registered?: boolean;
};

export function ShortcutRecorder({ value, onChange, registered }: Props): React.JSX.Element {
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Stop recording when focus leaves the element
  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const onBlur = (): void => {
      setIsRecording(false);
      setPreview('');
    };

    document.addEventListener('focusout', onBlur);
    return () => document.removeEventListener('focusout', onBlur);
  }, [isRecording]);

  const startRecording = (): void => {
    setIsRecording(true);
    setPreview('');
    containerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      setIsRecording(false);
      setPreview('');
      return;
    }

    // Show live modifiers-only preview while building the combo
    if (MODIFIER_KEYS.has(event.key)) {
      const modifiers: string[] = [];
      if (event.ctrlKey) modifiers.push('Ctrl');
      if (event.altKey) modifiers.push('Alt');
      if (event.shiftKey) modifiers.push('Shift');
      if (event.metaKey) modifiers.push('Win');
      setPreview(modifiers.join(' + '));
      return;
    }

    const accelerator = buildAccelerator(event);
    if (!accelerator) {
      return;
    }

    onChange(accelerator);
    setIsRecording(false);
    setPreview('');
  };

  const chips = acceleratorToChips(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          tabIndex={0}
          role="button"
          aria-label="Record shortcut"
          onKeyDown={isRecording ? handleKeyDown : undefined}
          onClick={startRecording}
          className={[
            'flex min-h-9 flex-1 cursor-pointer select-none items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isRecording
              ? 'border-ring bg-muted/50 ring-2 ring-ring'
              : 'border-input bg-background hover:bg-muted/40',
          ].join(' ')}
        >
          {isRecording ? (
            preview ? (
              <span className="text-muted-foreground">{preview} …</span>
            ) : (
              <span className="animate-pulse text-muted-foreground">Press a shortcut…</span>
            )
          ) : chips.length > 0 ? (
            chips.map((chip, i) => (
              <kbd
                key={i}
                className="inline-flex items-center rounded border border-input bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm"
              >
                {chip}
              </kbd>
            ))
          ) : (
            <span className="text-muted-foreground">Click to record…</span>
          )}
        </div>

        {/* Status indicator */}
        {registered !== undefined && !isRecording && value.trim() && (
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
              registered
                ? 'bg-green-500/15 text-green-500'
                : 'bg-red-500/15 text-red-500'
            }`}
            title={registered ? 'Shortcut registered' : 'Shortcut failed to register (may be in use)'}
          >
            {registered ? '✓' : '✕'}
          </div>
        )}

        {value.trim() && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            title="Clear shortcut"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click the field and press your desired key combination (e.g.{' '}
        <kbd className="rounded border border-muted-foreground/30 px-1 font-mono text-[10px]">Ctrl</kbd>
        {' / '}
        <kbd className="rounded border border-muted-foreground/30 px-1 font-mono text-[10px]">⌘</kbd>
        {' + '}
        <kbd className="rounded border border-muted-foreground/30 px-1 font-mono text-[10px]">Shift</kbd>
        {' + '}
        <kbd className="rounded border border-muted-foreground/30 px-1 font-mono text-[10px]">A</kbd>
        ). Press <kbd className="rounded border border-muted-foreground/30 px-1 font-mono text-[10px]">Esc</kbd> to cancel.
        Avoid OS-reserved combos like <kbd className="rounded border border-muted-foreground/30 px-1 font-mono text-[10px]">Alt+Space</kbd>.
        On macOS, Accessibility permission is required for global shortcuts.
      </p>
    </div>
  );
}
