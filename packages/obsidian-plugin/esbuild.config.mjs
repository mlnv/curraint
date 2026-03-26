import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import process from 'node:process';
import fs from 'node:fs';

const isWatch = process.argv.includes('--watch');
const isDev = isWatch;

function copyStaticFiles() {
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  fs.copyFileSync('styles.css', 'dist/styles.css');
}

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: 'inline',
  treeShaking: true,
  define: {
    __DEV__: String(isDev),
  },
  outfile: 'dist/main.js',
};

if (isWatch) {
  copyStaticFiles();
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  copyStaticFiles();
}
