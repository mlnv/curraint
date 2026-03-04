/**
 * Desktop renderer entry point — Vite aliases `@curraint/core` to this file.
 *
 * Re-exports the browser-safe subset of core (no Node.js fs/path) plus
 * desktop-specific types (AppSettings, ThemeId, SavedConnection, CurrAIntApi,
 * IPC_CHANNELS) so the renderer can import everything from a single alias.
 */

// Browser-safe core modules
export * from '../../core/src/chatSessionCore';
export * from '../../core/src/contextSafety';
export * from '../../core/src/debugLog';
export * from '../../core/src/defaults';
export * from '../../core/src/openaiCompatibleClient';
export * from '../../core/src/providers';
export * from '../../core/src/settings';
export * from '../../core/src/thinkTags';
export * from '../../core/src/types';

// Desktop-specific additions surfaced through the @curraint/core alias
export * from './types';    // AppSettings, ThemeId, SavedConnection
export * from './ipc';      // IPC_CHANNELS, CurrAIntApi, payload types
