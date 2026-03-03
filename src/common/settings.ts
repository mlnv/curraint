import { DEFAULT_SETTINGS } from './defaults';
import {
  CONTEXT_SAFETY_LIMIT_BOUNDS,
  normalizeContextLimit,
  truncateConversationForContext
} from './contextSafety';
import { isProviderId } from './providers';
import type { ChatMessage, EndpointSettings, SavedConnection, ThemeId } from './types';

const THEME_IDS: ThemeId[] = ['black', 'white', 'dark', 'monokai', 'retro-sand', 'retro-green'];

function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

function normalizeSavedConnections(raw: unknown): SavedConnection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: SavedConnection[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const c = item as Record<string, unknown>;
    if (typeof c['id'] !== 'string' || typeof c['name'] !== 'string') {
      continue;
    }

    result.push({
      id: c['id'],
      name: c['name'],
      provider:
        typeof c['provider'] === 'string' && isProviderId(c['provider'])
          ? c['provider']
          : 'custom',
      apiKey: typeof c['apiKey'] === 'string' ? c['apiKey'] : '',
      baseUrl: typeof c['baseUrl'] === 'string' ? c['baseUrl'] : '',
      model: typeof c['model'] === 'string' ? c['model'] : ''
    });
  }

  return result;
}

export function normalizeSettings(
  input: Partial<EndpointSettings> | EndpointSettings
): EndpointSettings {
  const providerCandidate = input.provider ?? DEFAULT_SETTINGS.provider;
  const provider = isProviderId(providerCandidate)
    ? providerCandidate
    : DEFAULT_SETTINGS.provider;

  return {
    provider,
    apiKey: (input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim(),
    baseUrl: (input.baseUrl ?? DEFAULT_SETTINGS.baseUrl).trim(),
    model: (input.model ?? DEFAULT_SETTINGS.model).trim(),
    systemPrompt: (input.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt).trim(),
    enableThinkTagFolding:
      input.enableThinkTagFolding ?? DEFAULT_SETTINGS.enableThinkTagFolding,
    contextMaxMessages: normalizeContextLimit(
      input.contextMaxMessages,
      DEFAULT_SETTINGS.contextMaxMessages,
      CONTEXT_SAFETY_LIMIT_BOUNDS.minMessages,
      CONTEXT_SAFETY_LIMIT_BOUNDS.maxMessages
    ),
    contextMaxCharacters: normalizeContextLimit(
      input.contextMaxCharacters,
      DEFAULT_SETTINGS.contextMaxCharacters,
      CONTEXT_SAFETY_LIMIT_BOUNDS.minCharacters,
      CONTEXT_SAFETY_LIMIT_BOUNDS.maxCharacters
    ),
    savedConnections: normalizeSavedConnections(input.savedConnections),
    quickInputShortcut:
      typeof input.quickInputShortcut === 'string' && input.quickInputShortcut.trim()
        ? input.quickInputShortcut.trim()
        : DEFAULT_SETTINGS.quickInputShortcut,
    theme: isThemeId(input.theme) ? input.theme : DEFAULT_SETTINGS.theme
  };
}

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[]
): ChatMessage[] {
  const { keptMessages, summary } = truncateConversationForContext(messages, {
    maxMessages: settings.contextMaxMessages,
    maxCharacters: settings.contextMaxCharacters
  });
  const composed: ChatMessage[] = [];

  if (settings.systemPrompt) {
    composed.push({ role: 'system', content: settings.systemPrompt });
  }

  if (summary) {
    composed.push({ role: 'system', content: summary });
  }

  composed.push(...keptMessages);
  return composed;
}
