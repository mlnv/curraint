import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

type MarkdownContentProps = {
  content: string;
};

function MarkdownContent({ content }: MarkdownContentProps): React.JSX.Element {
  return (
    <div className="space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => <th className="border px-2 py-1 text-left">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
          code: ({ children, className }) => {
            const isBlock = Boolean(className?.includes('language-'));

            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-xs">
                  {children}
                </code>
              );
            }

            return <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{children}</pre>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

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
        <div className="mt-2 text-xs text-muted-foreground">
          <MarkdownContent content={content} />
        </div>
      ) : null}
    </div>
  );
}

function AssistantMessageContent({
  content,
  enableThinkTagFolding
}: AssistantMessageProps): React.JSX.Element {
  if (!enableThinkTagFolding) {
    return <MarkdownContent content={content} />;
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
        <MarkdownContent content={visibleContent} />
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
            <MarkdownContent key={`text-${index}`} content={segment.content} />
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
