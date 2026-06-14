import type { ChatMessage, ProviderId } from '../types';

export type SavedSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  provider?: ProviderId;
  model?: string;
  profileId?: string;
};

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  provider?: ProviderId;
  model?: string;
};
