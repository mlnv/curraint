#!/usr/bin/env node
/**
 * Generates LICENSES.md from all production dependencies across the workspace.
 * Runs automatically before `pnpm build` via the prebuild lifecycle hook.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const raw = execSync('pnpm licenses list --json --prod', {
  cwd: rootDir,
  encoding: 'utf8',
});

const byLicense = JSON.parse(raw);

const packages = [];
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const pkg of pkgs) {
    packages.push({
      name: pkg.name,
      version: pkg.versions.join(', '),
      license,
      author: pkg.author || '',
      homepage: pkg.homepage || '',
    });
  }
}

packages.sort((a, b) => a.name.localeCompare(b.name));

const licenseCounts = {};
for (const pkg of packages) {
  licenseCounts[pkg.license] = (licenseCounts[pkg.license] || 0) + 1;
}

const date = new Date().toISOString().slice(0, 10);

const lines = [
  '# Third-Party Licenses',
  '',
  `> Auto-generated on ${date} by \`pnpm build\`. Do not edit manually.`,
  '',
  '## License summary',
  '',
  '| License | Packages |',
  '| ------- | -------: |',
  ...Object.entries(licenseCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lic, count]) => `| ${lic} | ${count} |`),
  '',
  '## All packages',
  '',
  '| Package | Version | License | Author |',
  '| ------- | ------- | ------- | ------ |',
  ...packages.map(({ name, version, license, author, homepage }) => {
    const nameCell = homepage ? `[${name}](${homepage})` : name;
    const authorCell = author.replace(/[|]/g, '\\|');
    return `| ${nameCell} | ${version} | ${license} | ${authorCell} |`;
  }),
  '',
];

const dest = join(rootDir, 'LICENSES.md');
writeFileSync(dest, lines.join('\n'), 'utf8');
console.log(`Generated LICENSES.md (${packages.length} packages)`);

// Also write a JSON snapshot consumed by the desktop renderer at build time.
const jsonDest = join(rootDir, 'packages/desktop/src/renderer/licenses-data.json');
writeFileSync(jsonDest, JSON.stringify(packages, null, 2), 'utf8');
console.log(`Generated licenses-data.json (${packages.length} packages)`);
