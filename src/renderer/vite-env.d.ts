/// <reference types="vite/client" />

import type { CurrAIntApi } from '../common/ipc';

declare global {
  interface Window {
    curraint: CurrAIntApi;
  }
}

export {};
