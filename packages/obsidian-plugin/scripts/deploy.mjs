#!/usr/bin/env node
/**
 * Copies the built plugin files from dist/ into a local Obsidian vault for testing.
 *
 * Setup (one-time):
 *   Create packages/obsidian-plugin/.vault-path containing the absolute path to
 *   your Obsidian vault root, e.g.:
 *     C:\Users\you\Documents\MyVault
 *
 * The script writes to <vault>/.obsidian/plugins/curraint/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const vaultPathFile = path.join(pkgRoot, '.vault-path');

if (!fs.existsSync(vaultPathFile)) {
  console.error(
    'Missing .vault-path file.\n' +
    'Create packages/obsidian-plugin/.vault-path with the absolute path to your\n' +
    'Obsidian vault root (e.g. C:\\Users\\you\\Documents\\MyVault).'
  );
  process.exit(1);
}

const vaultRoot = fs.readFileSync(vaultPathFile, 'utf8').trim();
if (!fs.existsSync(vaultRoot)) {
  console.error(`Vault path does not exist: ${vaultRoot}`);
  process.exit(1);
}

const dest = path.join(vaultRoot, '.obsidian', 'plugins', 'curraint');
fs.mkdirSync(dest, { recursive: true });

const files = ['main.js', 'styles.css'];
for (const file of files) {
  const src = path.join(pkgRoot, 'dist', file);
  if (!fs.existsSync(src)) {
    console.error(`Built file not found: ${src}\nRun the build first.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(dest, file));
  console.log(`  copied ${file}`);
}

// Append a random suffix on local builds so each deploy is distinguishable
// in Obsidian. CI environments set the CI variable, so skip the suffix there.
const manifestSrc = path.join(pkgRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestSrc, 'utf8'));
if (!process.env.CI) {
  const buildId = Math.random().toString(36).slice(2, 6);
  manifest.version = `${manifest.version}-${buildId}`;
}
fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`  wrote manifest.json (version: ${manifest.version})`);

console.log(`\nDeployed to ${dest}`);
