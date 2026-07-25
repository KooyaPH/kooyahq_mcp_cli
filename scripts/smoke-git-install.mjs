import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const prefix = mkdtempSync(join(tmpdir(), 'kooyahq-cli-git-install-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repository,
  encoding: 'utf8',
}).trim();
const repositoryUrl = pathToFileURL(repository);
const dependency = `git+file:${repositoryUrl.href.slice('file:'.length)}#${sha}`;
const executable = process.platform === 'win32'
  ? join(prefix, 'kooyahq.cmd')
  : join(prefix, 'bin', 'kooyahq');
const mcpExecutable = process.platform === 'win32'
  ? join(prefix, 'kooyahq-mcp.cmd')
  : join(prefix, 'bin', 'kooyahq-mcp');

try {
  execFileSync(npm, [
    'install',
    '--global',
    `--prefix=${prefix}`,
    '--install-links=true',
    dependency,
  ], { cwd: repository, stdio: 'inherit' });
  execFileSync(executable, ['--version'], { stdio: 'inherit' });
  execFileSync(executable, ['--help'], { stdio: 'ignore' });
  execFileSync(executable, [
    '--skill', 'tickets', 'create', '--output', 'json',
  ], { stdio: 'ignore' });
  execFileSync(mcpExecutable, ['--version'], { stdio: 'inherit' });
  execFileSync(mcpExecutable, ['--help'], { stdio: 'ignore' });
} finally {
  rmSync(prefix, { recursive: true, force: true });
}
