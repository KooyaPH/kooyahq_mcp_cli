import { execFileSync } from 'node:child_process';

const status = execFileSync('git', [
  'status',
  '--porcelain=v1',
  '--untracked-files=all',
  '--',
  'dist',
], { encoding: 'utf8' });

if (status.trim()) {
  process.stderr.write('Committed dist does not match the generated build:\n');
  process.stderr.write(status);
  process.exitCode = 1;
}
