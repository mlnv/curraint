/// <reference types="vite/client" />

import type { FlowAiApi } from '../common/ipc';

declare global {
  interface Window {
    flowai: FlowAiApi;
  }
}

export {};
