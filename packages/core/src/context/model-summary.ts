import type { ChatMessage } from '../types';

const SUMMARY_SYSTEM_PROMPT = [
  'You compress earlier chat turns so they can be safely replaced in future context.',
  'Write a concise factual summary of the provided conversation slice.',
  'Preserve user goals, constraints, decisions, file names, code details, errors, and unresolved tasks.',
  'Do not invent information.',
  'Return plain text bullet points only.',
  'Keep the result under 8 bullet points and under 1200 characters.'
].join(' ');

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content.trim()}`)
    .join('\n\n');
}

export function buildModelSummaryMessages(messages: ChatMessage[]): ChatMessage[] {
  return [
    {
      role: 'system',
      content: SUMMARY_SYSTEM_PROMPT
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