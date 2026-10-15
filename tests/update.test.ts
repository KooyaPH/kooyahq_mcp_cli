import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runCli, type RuntimeDependencies } from '../src/runtime/run.js';
import { LATEST_RELEASE_URL } from '../src/runtime/update.js';

interface Harness {
  dependencies: RuntimeDependencies;
  stdout: string[];
  stderr: string[];
  commands: string[][];
  prompts: string[];
  fetchedUrls: string[];
}

function harness(options: {
  tag?: string;
  status?: number;
  answer?: string;
  commandStatus?: (args: string[]) => number;
  homeDirectory?: string;
  packageRoot?: string;
} = {}): Harness {
  const result: Omit<Harness, 'dependencies'> = {
    stdout: [], stderr: [], commands: [], prompts: [], fetchedUrls: [],
  };
  const dependencies: RuntimeDependencies = {
    environment: {},
    homeDirectory: options.homeDirectory ?? '/missing-home',
    platform: 'linux',
    version: '0.3.0',
    fetch: async (url) => {
      result.fetchedUrls.push(String(url));
      return new Response(JSON.stringify({ tag_name: options.tag ?? 'v0.4.0' }), {
        status: options.status ?? 200,
      });
    },
    prompt: async (question) => {
      result.prompts.push(question);
      return options.answer ?? '';
    },
    readInputFile: async () => { throw new Error('file input must not be read'); },
    readStandardInput: async () => { throw new Error('standard input must not be read'); },
    update: {
      runCommand: async (command, args) => {
        result.commands.push([command, ...args]);
        return { status: options.commandStatus?.(args) ?? 0, stdout: '', stderr: 'npm failed' };
      },
      ...(options.packageRoot ? { packageRoot: options.packageRoot } : {}),
    },
    output: {
      stdout: (value) => result.stdout.push(value),
      stderr: (value) => result.stderr.push(value),
    },
  };
  return { ...result, dependencies };
}

const INSTALL = [
  'npm', 'install', '-g', '--install-links=true', '--ignore-scripts',
  'git+https://github.com/KooyaPH/kooyahq_mcp_cli.git#v0.4.0',
];

test('update --check reports a newer release without running npm', async () => {
  const h = harness();
  const code = await runCli(['update', '--check'], h.dependencies);
  assert.equal(code, 0);
  assert.deepEqual(h.fetchedUrls, [LATEST_RELEASE_URL]);
  assert.match(h.stdout.join('\n'), /Update available: 0\.3\.0 -> 0\.4\.0/);
  assert.deepEqual(h.commands, []);
  assert.deepEqual(h.prompts, []);
});

test('update reports up to date when the latest release is not newer', async () => {
  for (const tag of ['v0.3.0', 'v0.2.9']) {
    const h = harness({ tag });
    const code = await runCli(['update'], h.dependencies);
    assert.equal(code, 0);
    assert.match(h.stdout.join('\n'), /is up to date/);
    assert.deepEqual(h.commands, []);
    assert.deepEqual(h.prompts, []);
  }
});

test('update compares numeric version parts', async () => {
  const h = harness({ tag: 'v0.10.0' });
  await runCli(['update', '--check'], h.dependencies);
  assert.match(h.stdout.join('\n'), /Update available: 0\.3\.0 -> 0\.10\.0/);
});

test('update cancels unless the prompt is confirmed', async () => {
  const h = harness({ answer: 'n' });
  const code = await runCli(['update'], h.dependencies);
  assert.equal(code, 0);
  assert.equal(h.prompts.length, 1);
  assert.match(h.prompts[0]!, /\[y\/N\]$/);
  assert.match(h.stdout.join('\n'), /Cancelled\./);
  assert.deepEqual(h.commands, []);
});

test('confirmed update uninstalls then installs the release tag', async () => {
  const h = harness({ answer: 'y' });
  const code = await runCli(['update'], h.dependencies);
  assert.equal(code, 0);
  assert.deepEqual(h.commands, [['npm', 'uninstall', '-g', 'kooyahq-cli'], INSTALL]);
  assert.match(h.stdout.join('\n'), /Updated kooyahq-cli to 0\.4\.0/);
});

test('update --yes skips the prompt', async () => {
  const h = harness();
  const code = await runCli(['update', '--yes'], h.dependencies);
  assert.equal(code, 0);
  assert.deepEqual(h.prompts, []);
  assert.equal(h.commands.length, 2);
});

test('update stops when uninstall fails', async () => {
  const h = harness({ commandStatus: (args) => (args[0] === 'uninstall' ? 1 : 0) });
  const code = await runCli(['update', '--yes'], h.dependencies);
  assert.equal(code, 1);
  assert.equal(h.commands.length, 1);
  assert.match(h.stderr.join('\n'), /left unchanged/);
});

test('update prints the manual reinstall command when install fails', async () => {
  const h = harness({ commandStatus: (args) => (args[0] === 'install' ? 1 : 0) });
  const code = await runCli(['update', '--yes'], h.dependencies);
  assert.equal(code, 1);
  assert.match(h.stderr.join('\n'), /Reinstall manually: npm install -g .*#v0\.4\.0/);
});

test('update fails on a GitHub error or a malformed tag', async () => {
  const failed = harness({ status: 404 });
  assert.equal(await runCli(['update', '--check'], failed.dependencies), 1);
  assert.match(failed.stderr.join('\n'), /HTTP 404/);

  const malformed = harness({ tag: 'latest' });
  assert.equal(await runCli(['update', '--check'], malformed.dependencies), 1);
  assert.match(malformed.stderr.join('\n'), /not a vX\.Y\.Z version/);
});

test('update rejects unknown options before network traffic', async () => {
  const h = harness();
  const code = await runCli(['update', '--force'], h.dependencies);
  assert.equal(code, 2);
  assert.deepEqual(h.fetchedUrls, []);
  assert.match(h.stderr.join('\n'), /Usage: kooyahq update/);
});

test('update refreshes an installed Codex skill from the package', async () => {
  const home = await mkdtemp(join(tmpdir(), 'kooyahq-update-home-'));
  const packageRoot = await mkdtemp(join(tmpdir(), 'kooyahq-update-package-'));
  await mkdir(join(home, '.codex', 'skills', 'kooyahq-cli'), { recursive: true });
  await writeFile(join(home, '.codex', 'skills', 'kooyahq-cli', 'VERSION'), '0.3.0\n');
  await mkdir(join(packageRoot, 'skills', 'kooyahq-cli'), { recursive: true });
  await writeFile(join(packageRoot, 'skills', 'kooyahq-cli', 'SKILL.md'), '# skill\n');
  await writeFile(join(packageRoot, 'skills', 'kooyahq-cli', 'VERSION'), '0.4.0\n');

  const h = harness({ homeDirectory: home, packageRoot });
  assert.equal(await runCli(['update', '--yes'], h.dependencies), 0);
  assert.equal(await readFile(join(home, '.codex', 'skills', 'kooyahq-cli', 'VERSION'), 'utf8'), '0.4.0\n');
  assert.match(h.stdout.join('\n'), /Refreshed the kooyahq-cli Codex skill/);
});

test('update leaves Codex untouched when no skill is installed', async () => {
  const h = harness();
  assert.equal(await runCli(['update', '--yes'], h.dependencies), 0);
  assert.doesNotMatch(h.stdout.join('\n'), /Codex skill/);
});

test('update help is offline', async () => {
  const h = harness();
  assert.equal(await runCli(['update', '--help'], h.dependencies), 0);
  assert.match(h.stdout.join('\n'), /kooyahq update \[--check\] \[--yes\]/);
  assert.deepEqual(h.fetchedUrls, []);
});
