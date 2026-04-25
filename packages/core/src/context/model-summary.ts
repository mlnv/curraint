import type { ChatMessage } from '../types';

const DEFAULT_SUMMARY_MAX_BULLETS = 8;
const DEFAULT_SUMMARY_MAX_CHARACTERS = 1200;

export type SummaryPromptOptions = {
  maxBullets?: number;
  maxCharacters?: number;
};

export function buildSummarySystemPrompt(options: SummaryPromptOptions = {}): string {
  const maxBullets = options.maxBullets ?? DEFAULT_SUMMARY_MAX_BULLETS;
  const maxCharacters = options.maxCharacters ?? DEFAULT_SUMMARY_MAX_CHARACTERS;

  return [
    'You compress earlier chat turns so they can be safely replaced in future context.',
    'Write a concise factual summary of the provided conversation slice.',
    'Preserve user goals, constraints, decisions, file names, code details, errors, and unresolved tasks.',
    'Do not invent information.',
    'Return plain text bullet points only.',
    `Keep the result under ${maxBullets} bullet points and under ${maxCharacters} characters.`
  ].join(' ');
}

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content.trim()}`)
    .join('\n\n');
}

export function buildModelSummaryMessages(
  messages: ChatMessage[],
  options: SummaryPromptOptions = {}
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: buildSummarySystemPrompt(options)
    },
    {
      role: 'user',
      content: [
        'Summarize the earlier conversation turns below so they can replace the original messages in future context.',
        'Keep important facts and open threads, but stay concise.',
        '',
        formatConversation(messages)
      ].join('\n')
    }
  ];
}