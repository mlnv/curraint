/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

import type { CurraintApi } from '@curraint/core';

declare global {
  interface Window {
    curraint: CurraintApi;
  }
}

export {};
