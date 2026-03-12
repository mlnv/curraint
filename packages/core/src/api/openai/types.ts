export type CompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
    text?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: { message?: string };
};

export type ErrorResponse = {
  error?: { message?: string };
};

export type StreamCallbacks = {
  onDelta: (delta: string) => void;
};

export type StreamOptions = {
  signal?: AbortSignal;
};
