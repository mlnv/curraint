import { useEffect, useMemo, useRef, useState } from 'react';
import { createChatSessionCore } from '@curraint/core';
import type { ChatMessage } from '@curraint/core';

export type UseChatSessionResult = {
  conversation: ChatMessage[];
  prompt: string;
  status: string;
  isSending: boolean;
  isStopping: boolean;
  canSend: boolean;
  setPrompt: (value: string) => void;
  submitPrompt: (content: string) => Promise<void>;
  editUserMessage: (index: number, editedContent: string) => void;
  stopResponse: () => void;
  clearConversation: () => void;
};

export function useChatSession(): UseChatSessionResult {
  const sessionRef = useRef(
    createChatSessionCore({
      streamChat: (messages, onDelta) => window.curraint.chatStream(messages, onDelta),
      cancelChatStream: () => window.curraint.cancelChatStream(),
      clearSession: () => window.curraint.clearChatSession()
    })
  );
  const [conversation, setConversation] = useState<ChatMessage[]>(
    sessionRef.current.getState().conversation
  );
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState(sessionRef.current.getState().status);
  const [isSending, setIsSending] = useState(sessionRef.current.getState().isSending);
  const [isStopping, setIsStopping] = useState(sessionRef.current.getState().isStopping);

  useEffect(() => {
    return sessionRef.current.subscribe({
      onStateChange: (nextState) => {
        setConversation(nextState.conversation);
        setStatus(nextState.status);
        setIsSending(nextState.isSending);
        setIsStopping(nextState.isStopping);
      }
    });
  }, []);

  const canSend = useMemo(() => !isSending && prompt.trim().length > 0, [isSending, prompt]);

  const submitPrompt = async (content: string): Promise<void> => {
    if (isSending || !content.trim()) {
      return;
    }

    setPrompt('');
    await sessionRef.current.submitPrompt(content);
  };

  const editUserMessage = (index: number, editedContent: string): void => {
    void sessionRef.current.editUserMessage(index, editedContent);
  };

  const stopResponse = (): void => {
    void sessionRef.current.stopResponse();
  };

  const clearConversation = (): void => {
    sessionRef.current.clearConversation();
  };

  return {
    conversation,
    prompt,
    status,
    isSending,
    isStopping,
    canSend,
    setPrompt,
    submitPrompt,
    editUserMessage,
    stopResponse,
    clearConversation
  };
}
