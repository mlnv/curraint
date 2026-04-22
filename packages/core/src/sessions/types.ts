import type { CompactedContext } from '../context';
import type { ChatMessage } from '../types';

export type SavedSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  compactedContext?: CompactedContext | null;
};

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};
