// Shared base types
export type { ProviderId, ChatMessage, ChatResult } from './types';
export { ENABLE_COPILOT_PROVIDER } from './features';

// Domain modules
export * from './chat';
export * from './context';
export * from './providers';
export * from './settings';
export * from './secrets';
export * from './think-tags';
export { debugLog, setDebugEnabled } from './debug/log';

// API clients
export {
  testConnection,
  chatCompletion,
  chatCompletionStream
} from './api/openai/client';
export type { StreamCallbacks, StreamOptions } from './api/openai/types';
export {
  copilotChatStream,
  warmupCopilotSession,
  resetCopilotSession,
  copilotTestConnection,
  stopCopilotClient
} from './api/copilot';
export type { CopilotStreamCallbacks, CopilotStreamOptions } from './api/copilot';
