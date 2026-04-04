// Import types only — erased at compile time, safe in CJS builds.
import type {
  CopilotClient as CopilotClientType,
  CopilotSession as CopilotSessionType,
  approveAll as approveAllType
} from '@github/copilot-sdk';

export type Sdk = {
  CopilotClient: typeof CopilotClientType;
  approveAll: typeof approveAllType;
};

export type SessionState = {
  client: CopilotClientType;
  session: CopilotSessionType;
  model: string;
  systemPrompt: string;
  /** Number of user messages sent; distinguishes a fresh (warmup) session. */
  messageCount: number;
};

export type CopilotStreamCallbacks = {
  onDelta: (delta: string) => void;
};

export type CopilotStreamOptions = {
  signal?: AbortSignal;
};
