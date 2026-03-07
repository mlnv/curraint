import { useRef, useState } from 'react';
import type { ChatMessage } from '@curraint/core';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { AssistantMessageContent } from './assistant-message-content';

type Props = {
  messages: ChatMessage[];
  isSending: boolean;
  enableThinkTagFolding: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onContainerScroll?: () => void;
  onEditUserMessage?: (index: number, content: string) => void;
};

function formatTime(ts: number | undefined): string {
  if (ts === undefined) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessageList({
  messages,
  isSending,
  enableThinkTagFolding,
  containerRef,
  onContainerScroll,
  onEditUserMessage
}: Props): React.JSX.Element {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const timestampsRef = useRef<Map<number, number>>(new Map());

  // Stamp each new message index the first time it appears
  messages.forEach((_, i) => {
    if (!timestampsRef.current.has(i)) {
      timestampsRef.current.set(i, Date.now());
    }
  });

  const startEdit = (index: number, content: string): void => {
    setEditingIndex(index);
    setEditingContent(content);
  };

  const cancelEdit = (): void => {
    setEditingIndex(null);
    setEditingContent('');
  };

  const saveEdit = (index: number): void => {
    if (!onEditUserMessage) {
      return;
    }

    onEditUserMessage(index, editingContent);
    cancelEdit();
  };

  return (
    <div
      ref={containerRef}
      onScroll={onContainerScroll}
      className="flex-1 space-y-1 overflow-y-auto p-3"
    >
      {messages.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Start typing to chat.
        </div>
      ) : null}

      {messages.map((message, index) =>
        message.role === 'user' ? (
          /* ── User bubble ──────────────────────────────────────────── */
          <div key={`${message.role}-${index}`} className="group mb-2 flex flex-col items-end">
            <div
              className={`max-w-[88%] bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground ${
                editingIndex === index
                  ? 'w-full max-w-full rounded-xl border border-border bg-card text-foreground'
                  : 'rounded-2xl rounded-br-sm'
              }`}
            >
              {editingIndex === index ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    className="min-h-[80px]"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveEdit(index)}
                      disabled={editingContent.trim().length === 0 || isSending}
                    >
                      Save & resend
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="whitespace-pre-wrap">{message.content}</span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => startEdit(index, message.content)}
                      disabled={isSending}
                      className="rounded px-1.5 py-0.5 text-[10px] text-primary-foreground/60 opacity-0 transition-all hover:bg-black/10 hover:text-primary-foreground group-hover:opacity-100 disabled:pointer-events-none"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span className="mt-0.5 pr-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(timestampsRef.current.get(index))}
            </span>
          </div>
        ) : (
          /* ── Assistant bubble ─────────────────────────────────────── */
          <div key={`${message.role}-${index}`} className="group mb-2 flex flex-col items-start">
            <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-card-foreground">
              {isSending && index === messages.length - 1 && message.content === '' ? (
                <div className="flex items-center gap-1.5 px-0.5 py-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              ) : (
                <AssistantMessageContent
                  content={message.content}
                  enableThinkTagFolding={enableThinkTagFolding}
                />
              )}
            </div>
            <span className="mt-0.5 pl-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(timestampsRef.current.get(index))}
            </span>
          </div>
        )
      )}

      {/* ── Typing indicator (only when no empty assistant message is already shown) ── */}
      {isSending && !(messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1].content === '') ? (
        <div className="mb-2 flex flex-col items-start">
          <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3.5">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
