import { useState } from 'react';
import type { ChatMessage } from '../../../common/types';
import {
  getUnclosedReasoningTagStart,
  hasThinkTag,
  parseThinkTags,
  stripLeadingReasoningTag
} from '../../../common/thinkTags';
import { Button } from '../ui/button';

type Props = {
  messages: ChatMessage[];
  isSending: boolean;
  enableThinkTagFolding: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

type AssistantMessageProps = {
  content: string;
  enableThinkTagFolding: boolean;
};

type ThinkBlockProps = {
  content: string;
  isStreaming?: boolean;
};

function ThinkBlock({ content, isStreaming = false }: ThinkBlockProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-md border border-dashed bg-muted/40 p-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'Hide reasoning details' : 'Show reasoning details'}
      </Button>
      {isStreaming ? (
        <p className="mt-1 text-xs text-muted-foreground">Reasoning is still streaming…</p>
      ) : null}
      {isOpen ? (
        <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
          {content}
        </p>
      ) : null}
    </div>
  );
}

function AssistantMessageContent({
  content,
  enableThinkTagFolding
}: AssistantMessageProps): React.JSX.Element {
  if (!enableThinkTagFolding) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  const unclosedTagStart = getUnclosedReasoningTagStart(content);
  const visibleContent = unclosedTagStart >= 0 ? content.slice(0, unclosedTagStart) : content;
  const streamingReasoningContent =
    unclosedTagStart >= 0
      ? stripLeadingReasoningTag(content.slice(unclosedTagStart))
      : null;

  if (!hasThinkTag(visibleContent)) {
    return (
      <div className="space-y-2">
        <span className="whitespace-pre-wrap">{visibleContent}</span>
        {streamingReasoningContent !== null ? (
          <ThinkBlock
            content={streamingReasoningContent}
            isStreaming
          />
        ) : null}
      </div>
    );
  }

  const segments = parseThinkTags(visibleContent).filter(
    (segment) => segment.content.length > 0
  );

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <p key={`text-${index}`} className="whitespace-pre-wrap">
              {segment.content}
            </p>
          );
        }

        return <ThinkBlock key={`think-${index}`} content={segment.content} />;
      })}
      {streamingReasoningContent !== null ? (
        <ThinkBlock
          content={streamingReasoningContent}
          isStreaming
        />
      ) : null}
    </div>
  );
}

export function ChatMessageList({
  messages,
  isSending,
  enableThinkTagFolding,
  containerRef
}: Props): React.JSX.Element {
  return (
    <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto p-3">
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
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
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
