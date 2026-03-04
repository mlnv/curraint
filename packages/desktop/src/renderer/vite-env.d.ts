/// <reference types="vite/client" />

import type { CurrAIntApi } from '@curraint/core';

declare global {
  interface Window {
    curraint: CurrAIntApi;
  }
}

export {};
