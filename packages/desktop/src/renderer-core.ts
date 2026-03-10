/**
 * Desktop renderer entry point — Vite aliases `@curraint/core` to this file.
 *
 * Re-exports the browser-safe subset of core (no Node.js fs/path) plus
 * desktop-specific types (AppSettings, ThemeId, SavedConnection, CurraintApi,
 * IPC_CHANNELS) so the renderer can import everything from a single alias.
 */

// Browser-safe core modules (no Node.js fs/path/crypto)
export * from '../../core/src/chat';
export * from '../../core/src/context';
export { debugLog } from '../../core/src/debug/log';
export { DEFAULT_SETTINGS } from '../../core/src/settings/defaults';
export { normalizeSettings } from '../../core/src/settings/normalizer';
export { composeConversation } from '../../core/src/settings/composer';
export type { EndpointSettings } from '../../core/src/settings/types';
export { testConnection, chatCompletion, chatCompletionStream } from '../../core/src/api/openai/client';
export type { StreamCallbacks, StreamOptions } from '../../core/src/api/openai/types';
export * from '../../core/src/providers';
export * from '../../core/src/think-tags';
export type { ProviderId, ChatMessage, ChatResult } from '../../core/src/types';

// Desktop-specific additions surfaced through the @curraint/core alias
export * from './types';    // AppSettings, ThemeId, SavedConnection
export * from './ipc';      // IPC_CHANNELS, CurraintApi, payload types
export type { SavedSession, SessionSummary } from '../../core/src/sessions/types';
