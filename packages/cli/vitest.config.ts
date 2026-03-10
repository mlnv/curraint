import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: {
      // Force chalk to emit ANSI codes even without a TTY, so the tests that
      // verify styling (bold, italic, code highlighting) behave consistently.
      FORCE_COLOR: '1',
    },
  },
});
