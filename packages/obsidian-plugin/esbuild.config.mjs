import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import process from 'node:process';
import fs from 'node:fs';

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev') || isWatch;

function copyStaticFiles() {
  fs.mkdirSync('dist', { recursive: true });
  for (const fileName of ['manifest.json', 'styles.css']) {
    if (!fs.existsSync(fileName)) {
      console.warn(`Curraint: Skipping missing static file ${fileName}`);
      continue;
    }

    fs.copyFileSync(fileName, `dist/${fileName}`);
  }
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
