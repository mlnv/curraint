import { useState } from 'react';
import type { ChatMessage } from '../../../common/types';
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
      className="flex-1 space-y-3 overflow-y-auto p-3"
    >
      {messages.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Start typing to chat.
        </div>
      ) : null}

      {messages.map((message, index) => (
        <div
          key={`${message.role}-${index}`}
          className={`max-w-[92%] rounded-md border px-3 py-2 text-sm leading-relaxed ${
            message.role === 'user' ? 'ml-auto bg-muted' : 'mr-auto bg-background'
          }`}
        >
          {message.role === 'assistant' ? (
            <AssistantMessageContent
              content={message.content}
              enableThinkTagFolding={enableThinkTagFolding}
            />
          ) : editingIndex === index ? (
            <div className="space-y-2">
              <Textarea
                value={editingContent}
                onChange={(event) => setEditingContent(event.target.value)}
                className="min-h-[80px]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                >
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(index, message.content)}
                  disabled={isSending}
                >
                  Edit
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {isSending ? (
        <div className="mr-auto flex max-w-[92%] items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      ) : null}
    </div>
  );
}
