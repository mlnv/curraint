import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(dirname, 'src/__mocks__/obsidian.ts'),
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
  },
});
