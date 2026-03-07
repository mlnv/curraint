export type CompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
    text?: string;
  }>;
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
