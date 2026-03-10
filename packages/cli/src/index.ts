import { stdout as output } from 'node:process';
import { version } from '../package.json';
import { run } from './run';

if (process.argv.includes('--version') || process.argv.includes('-V')) {
  output.write(`${version}\n`);
  process.exit(0);
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    output.write(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  });