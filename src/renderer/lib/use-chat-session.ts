import { useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../../common/types';
import { toErrorMessage } from './errors';

export type UseChatSessionResult = {
  conversation: ChatMessage[];
  prompt: string;
  status: string;
  isSending: boolean;
  isStopping: boolean;
  canSend: boolean;
  lastAssistantMessage: string;
  setPrompt: (value: string) => void;
  submitPrompt: (content: string) => Promise<void>;
  editUserMessage: (index: number, editedContent: string) => void;
  stopResponse: () => void;
};

export function useChatSession(): UseChatSessionResult {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const isCancellingRef = useRef(false);

  const canSend = useMemo(() => !isSending && prompt.trim().length > 0, [isSending, prompt]);

  const lastAssistantMessage = useMemo(() => {
    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      const message = conversation[index];
      if (message.role === 'assistant' && message.content.trim().length > 0) {
        return message.content;
      }
    }

    return '';
  }, [conversation]);

  const resendFromConversation = async (nextConversation: ChatMessage[]): Promise<void> => {
    const assistantIndex = nextConversation.length;
    setConversation([...nextConversation, { role: 'assistant' as const, content: '' }]);
    setStatus('Thinking...');
    setIsSending(true);
    setIsStopping(false);
    isCancellingRef.current = false;

    try {
      const reply = await window.flowai.chatStream(nextConversation, (delta) => {
        setConversation((prev) =>
          prev.map((message, index) =>
            index === assistantIndex && message.role === 'assistant'
              ? { ...message, content: message.content + delta }
              : message
          )
        );
      });

      setConversation((prev) => {
        const assistant = prev[assistantIndex];
        if (
          isCancellingRef.current &&
          assistant?.role === 'assistant' &&
          reply.trim().length === 0
        ) {
          return prev.filter((_, index) => index !== assistantIndex);
        }

        return prev.map((message, index) =>
          index === assistantIndex && message.role === 'assistant'
            ? { ...message, content: reply }
            : message
        );
      });

      setStatus(isCancellingRef.current ? 'Response stopped' : '');
    } catch (error) {
      if (isCancellingRef.current) {
        setConversation((prev) => {
          const assistant = prev[assistantIndex];
          if (assistant?.role === 'assistant' && assistant.content.trim().length === 0) {
            return prev.filter((_, index) => index !== assistantIndex);
          }

          return prev;
        });
        setStatus('Response stopped');
      } else {
        setConversation((prev) => prev.filter((_, index) => index !== assistantIndex));
        setStatus(toErrorMessage(error));
      }
    } finally {
      setIsSending(false);
      setIsStopping(false);
      isCancellingRef.current = false;
    }
  };

  const submitPrompt = async (content: string): Promise<void> => {
    const trimmed = content.trim();
    if (!trimmed || isSending) {
      return;
    }

    const nextConversation = [...conversation, { role: 'user' as const, content: trimmed }];
    setPrompt('');
    await resendFromConversation(nextConversation);
  };

  const editUserMessage = (index: number, editedContent: string): void => {
    if (isSending) {
      return;
    }

    const trimmedContent = editedContent.trim();
    if (!trimmedContent) {
      return;
    }

    const target = conversation[index];
    if (!target || target.role !== 'user') {
      return;
    }

    if (target.content === trimmedContent) {
      return;
    }

    const nextConversation = conversation
      .slice(0, index + 1)
      .map((message, messageIndex) =>
        messageIndex === index ? { ...message, content: trimmedContent } : message
      );

    void resendFromConversation(nextConversation);
  };

  const stopResponse = (): void => {
    if (!isSending || isStopping) {
      return;
    }

    isCancellingRef.current = true;
    setIsStopping(true);
    setStatus('Stopping response...');
    void window.flowai.cancelChatStream().catch(() => {
      setStatus('Failed to stop response');
    });
  };

  return {
    conversation,
    prompt,
    status,
    isSending,
    isStopping,
    canSend,
    lastAssistantMessage,
    setPrompt,
    submitPrompt,
    editUserMessage,
    stopResponse
  };
}
