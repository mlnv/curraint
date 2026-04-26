import type { CompactedContext } from '../context';
import type { ChatMessage } from '../types';

export const COMPACTED_CONTEXT_SCHEMA_VERSION = 1 as const;

export type SavedSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  /**
   * Optional summarized older context for this session.
   * The absence form is `undefined`.
   */
  compactedContext?: CompactedContext;
  /**
   * Schema version for the persisted compacted-context payload.
   * Use this to distinguish legacy `sourceMessageCount` semantics from the
   * current slice-index representation.
   */
  compactedContextSchemaVersion?: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};
