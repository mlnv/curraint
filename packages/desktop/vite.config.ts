import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      // Point Vite at the browser-safe TS source so it can tree-shake Node-only modules
      '@curraint/core': resolve(__dirname, './src/renderer-core.ts')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat: resolve(__dirname, 'src/renderer/index.html'),
        settings: resolve(__dirname, 'src/renderer/settings.html'),
        quickInput: resolve(__dirname, 'src/renderer/quick-input.html')
      }
    }
  }
});
