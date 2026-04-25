import type { ContextUsage } from '@curraint/core';

type Props = {
  contextUsage: ContextUsage;
  isCompactingContext: boolean;
  contextActionMessage: string;
  onSummarize: () => void;
};

const TONE_CLASS: Record<ContextUsage['tone'], string> = {
  danger: 'text-rose-500',
  warn: 'text-amber-500',
  safe: 'text-emerald-500'
};

export function ContextMeter({
  contextUsage,
  isCompactingContext,
  contextActionMessage,
  onSummarize
}: Props): React.JSX.Element {
  const meterStroke = 2 * Math.PI * 18;
  const meterPercent = Math.max(0, Math.min(contextUsage.percent, 100));
  const meterOffset = meterStroke - (meterStroke * meterPercent) / 100;

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/70 text-[9px] font-semibold text-foreground shadow-sm transition hover:bg-muted"
        title="Show context usage"
        aria-label="Show context usage"
      >
        <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/50" />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={meterStroke}
            strokeDashoffset={meterOffset}
            className={TONE_CLASS[contextUsage.tone]}
          />
        </svg>
        <span className="relative z-10">{contextUsage.percent}%</span>
      </button>
      <div className="invisible absolute bottom-full right-0 z-20 mb-2 w-72 rounded-2xl border border-border bg-background/95 p-3 text-left opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div aria-hidden="true" className="curraint-chat-context-popup-bridge absolute right-0 top-full h-2 w-full" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Context budget
        </p>
        <p className="mt-2 text-sm text-foreground">
          {contextUsage.percent}% of the active request budget is in use.
        </p>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>{contextUsage.usedMessages} / {contextUsage.maxMessages} composed messages</p>
          <p>{contextUsage.usedCharacters} / {contextUsage.maxCharacters} composed characters</p>
          <p>{contextUsage.hasCompactedContext ? `${contextUsage.compactedMessages} older messages are already condensed into older context` : 'No older context has been condensed yet'}</p>
        </div>
        {contextActionMessage ? (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-foreground">
            {contextActionMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onSummarize}
          disabled={isCompactingContext}
          className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          {isCompactingContext ? 'Summarizing...' : 'Summarize older context'}
        </button>
      </div>
    </div>
  );
}