// Verbose logging helpers for plugin development.
//
// __DEV__ is injected at build time by esbuild:
//   - true  during `pnpm dev` (watch mode)
//   - false during `pnpm build` / `pnpm deploy`
//
// esbuild's tree-shaking eliminates all log() call-sites in production
// builds because the `if (false)` branches are statically dead code.
//
// Usage:
//   import { log } from './log';
//   log('transport', 'sending request', { url, model });
//
// Logs appear in the Obsidian developer console (Ctrl+Shift+I / Cmd+Option+I)
// tagged with "[curraint:<scope>]" so you can filter by "curraint".

declare const __DEV__: boolean;

export function log(scope: string, ...args: unknown[]): void {
  if (__DEV__) {
    console.debug(`[curraint:${scope}]`, ...args);
  }
}
