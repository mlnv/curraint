import type { ChatMessage } from '../types';

export type SavedSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};
