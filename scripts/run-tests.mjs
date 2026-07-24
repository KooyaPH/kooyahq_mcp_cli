import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const tests = readdirSync(join(root, 'tests'))
  .filter((name) => name.endsWith('.test.ts'))
  .sort()
  .map((name) => join(root, 'tests', name));
const tsxCli = require.resolve('tsx/cli');
const result = spawnSync(process.execPath, [tsxCli, '--test', ...tests], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
