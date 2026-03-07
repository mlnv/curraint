/// <reference types="vite/client" />

import type { CurraintApi } from '@curraint/core';

declare global {
  interface Window {
    curraint: CurraintApi;
  }
}

export {};
