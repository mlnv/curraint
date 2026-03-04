import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main/main.ts', 'src/main/preload.ts'],
  format: ['cjs'],
  outDir: 'dist/main',
  // electron and electron-log stay as runtime externals; everything else
  // (including @curraint/core) is bundled inline so there are
  // no pnpm-symlink resolution surprises inside Electron's Node context.
  external: ['electron', 'electron-log'],
  noExternal: [/@curraint\/.*/],
  clean: false
});
