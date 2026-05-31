import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  noExternal: [
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-ai'
  ],
  dts: {
    compilerOptions: {
      composite: false
    }
  }
});