export const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
} as const;

export const divider = (): string =>
  `${c.dim}${'─'.repeat(Math.max(20, (process.stdout.columns ?? 60) - 2))}${c.reset}`;
