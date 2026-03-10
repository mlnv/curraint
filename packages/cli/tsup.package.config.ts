import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  platform: 'node',
  format: ['cjs'],
  outDir: 'dist',
  // Bundle @curraint/core inline so the output is a single portable file
  // that runs without any node_modules present on the target machine.
  noExternal: [/@curraint\/.*/],
});
