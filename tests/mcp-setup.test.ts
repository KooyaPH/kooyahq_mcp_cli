import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  doctorCodexIntegration,
  doctorCursorIntegration,
  installCodexIntegration,
  installCursorIntegration,
  type SetupDependencies,
  type SetupOverrides,
} from '../src/mcp/setup/index.js';
import { codexExecutable, commandRequiresShell } from '../src/mcp/setup/process.js';
import { installSkill } from '../src/mcp/setup/skill.js';
import { runCli, type RuntimeDependencies } from '../src/runtime/run.js';

test('Cursor installer configures the desktop app and Cursor Agent without replacing other servers', async () => {
  const fixture = await setupFixture();
  const configPath = join(fixture.home, '.cursor', 'mcp.json');
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify({
    mcpServers: { existing: { command: '/other/server', args: ['--keep'] } },
  }, null, 2));

  await installCursorIntegration(fixture.dependencies);
  await installCursorIntegration(fixture.dependencies);

  const config = JSON.parse(await readFile(configPath, 'utf8')) as {
    mcpServers: Record<string, { command: string; args: string[] }>;
  };
  assert.deepEqual(config.mcpServers.existing, { command: '/other/server', args: ['--keep'] });
  assert.deepEqual(config.mcpServers.kooyahq, {
    command: fixture.dependencies.nodeExecutable,
    args: [join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js')],
  });

  const report = await doctorCursorIntegration({
    ...fixture.dependencies,
    probeMcp: async () => ({
      protocolVersion: '2025-06-18',
      tools: ['kooyahq_status', 'kooyahq_discover', 'kooyahq_call'],
    }),
  }, true);
  assert.equal(report.ok, true);
  assert.match(JSON.stringify(report), /Cursor registration/i);
  assert.match(JSON.stringify(report), /authenticated KooyaHQ profile/i);
});

test('Cursor installer rejects a non-local existing kooyahq entry without writing', async () => {
  const fixture = await setupFixture();
  const configPath = join(fixture.home, '.cursor', 'mcp.json');
  const existing = JSON.stringify({
    mcpServers: {
      kooyahq: { command: '/other/node', args: ['/other/server.js'] },
    },
  });
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, existing);

  await assert.rejects(installCursorIntegration(fixture.dependencies), /existing kooyahq.*no changes/i);
  assert.equal(await readFile(configPath, 'utf8'), existing);
});

test('JSON registration preserves other servers, uses the absolute descriptor, and rejects unsafe configuration', async () => {
  const fixture = await setupFixture();
  const output: string[] = [];
  const geminiConfig = join(fixture.home, '.gemini', 'settings.json');
  const antigravityConfig = join(fixture.home, '.gemini', 'config', 'mcp_config.json');
  await mkdir(dirname(geminiConfig), { recursive: true });
  await mkdir(dirname(antigravityConfig), { recursive: true });
  await writeFile(geminiConfig, JSON.stringify({
    keep: { setting: true },
    mcpServers: { other: { command: '/other/server', args: ['--keep'] } },
  }, null, 2));
  await writeFile(antigravityConfig, JSON.stringify({
    mcpServers: { other: { command: '/other/antigravity', args: ['--keep'] } },
  }, null, 2));

  const runtime = runtimeDependencies(fixture, output);
  assert.equal(await runCli(['mcp', 'install', '--client', 'gemini'], runtime), 0);
  assert.equal(await runCli(['mcp', 'install', '--client', 'antigravity'], runtime), 0);

  const expected = {
    command: fixture.dependencies.nodeExecutable,
    args: [join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js')],
  };
  const gemini = JSON.parse(await readFile(geminiConfig, 'utf8')) as {
    keep: unknown;
    mcpServers: Record<string, unknown>;
  };
  const antigravity = JSON.parse(await readFile(antigravityConfig, 'utf8')) as {
    mcpServers: Record<string, unknown>;
  };
  assert.deepEqual(gemini.keep, { setting: true });
  assert.deepEqual(gemini.mcpServers.other, { command: '/other/server', args: ['--keep'] });
  assert.deepEqual(gemini.mcpServers.kooyahq, expected);
  assert.deepEqual(antigravity.mcpServers.other, {
    command: '/other/antigravity', args: ['--keep'],
  });
  assert.deepEqual(antigravity.mcpServers.kooyahq, expected);
  assert.match(await readFile(geminiConfig, 'utf8'), /\n$/);

  await writeFile(geminiConfig, JSON.stringify({
    ...gemini,
    mcpServers: {
      ...gemini.mcpServers,
      kooyahq: { ...expected, env: { KOOYAHQ_SECRET_ACCESS_KEY: 'stale-secret' } },
    },
  }));
  output.length = 0;
  assert.equal(await runCli(['mcp', 'doctor', '--client', 'gemini'], runtime), 2);
  assert.match(output.join('\n'), /Gemini CLI has no current KooyaHQ MCP entry/i);
  assert.doesNotMatch(output.join('\n'), /stale-secret/);
  const stale = await readFile(geminiConfig, 'utf8');
  output.length = 0;
  assert.equal(await runCli(['mcp', 'install', '--client', 'gemini'], runtime), 2);
  assert.match(output.join('\n'), /existing kooyahq.*no changes/i);
  assert.equal(await readFile(geminiConfig, 'utf8'), stale);

  const unsafe = JSON.stringify({
    mcpServers: [],
    KOOYAHQ_SECRET_ACCESS_KEY: 'do-not-print-this',
  });
  await writeFile(geminiConfig, unsafe);
  output.length = 0;
  assert.equal(await runCli(['mcp', 'install', '--client', 'gemini'], runtime), 2);
  assert.equal(await readFile(geminiConfig, 'utf8'), unsafe);
  assert.doesNotMatch(output.join('\n'), /do-not-print-this/);

  const reportRuntime = runtimeDependencies(fixture, output);
  output.length = 0;
  assert.equal(await runCli(['mcp', 'doctor', '--client', 'antigravity'], reportRuntime), 0);
  assert.match(output.join('\n'), /Antigravity registration/i);
  assert.match(output.join('\n'), /MCP handshake/i);
});

test('Claude registers only after its exact absent signal; OpenClaw and Hermes fail closed while their state is unverifiable', async () => {
  const fixture = await setupFixture();
  const output: string[] = [];
  const calls: Array<{ command: string; args: string[] }> = [];
  const registered = new Set<string>();
  const accessKey = 'access-key-must-not-reach-client-command';
  const secret = 'secret-must-not-reach-client-command';
  const runtime = runtimeDependencies(fixture, output, {
    KOOYAHQ_ACCESS_KEY_ID: accessKey,
    KOOYAHQ_SECRET_ACCESS_KEY: secret,
  }, {
    runCommand: async (command, args) => {
      calls.push({ command, args });
      if (args.includes('add-json') || args.includes('add')) registered.add(command);
      if (args.includes('get')) {
        return registered.has(command)
          ? { status: 0, stdout: '', stderr: '' }
          : claudeMissingResult();
      }
      if (args.includes('show') || args.includes('doctor') || args.includes('test')) {
        return { status: 1, stdout: '', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  const script = join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js');

  assert.equal(await runCli(['mcp', 'install', '--client', 'claude'], runtime), 0);
  output.length = 0;
  assert.equal(await runCli(['mcp', 'install', '--client', 'openclaw'], runtime), 2);
  assert.match(output.join('\n'), /OpenClaw.*manual registration/i);
  output.length = 0;
  assert.equal(await runCli(['mcp', 'install', '--client', 'hermes'], runtime), 2);
  assert.match(output.join('\n'), /Hermes.*manual registration/i);
  assert.equal(await runCli(['mcp', 'doctor', '--client', 'claude'], runtime), 0);
  assert.equal(await runCli(['mcp', 'doctor', '--client', 'openclaw'], runtime), 2);
  assert.equal(await runCli(['mcp', 'doctor', '--client', 'hermes'], runtime), 2);

  assert.deepEqual(calls, [
    { command: 'claude', args: ['mcp', 'get', 'kooyahq'] },
    {
      command: 'claude',
      args: ['mcp', 'add-json', '--scope', 'user', 'kooyahq', JSON.stringify({
        type: 'stdio',
        command: fixture.dependencies.nodeExecutable,
        args: [script],
      })],
    },
    { command: 'openclaw', args: ['mcp', 'show', 'kooyahq'] },
    { command: 'hermes', args: ['mcp', 'test', 'kooyahq'] },
    { command: 'claude', args: ['mcp', 'get', 'kooyahq'] },
    { command: 'openclaw', args: ['mcp', 'doctor', 'kooyahq', '--probe'] },
    { command: 'hermes', args: ['mcp', 'test', 'kooyahq'] },
  ]);
  assert.doesNotMatch(JSON.stringify(calls), new RegExp(`${accessKey}|${secret}`));
  assert.match(output.join('\n'), /Claude Code/i);
  assert.doesNotMatch(JSON.stringify(calls), /openclaw.*mcp","add|hermes.*mcp","add/);
});

test('command-managed installers refuse a registration that cannot be verified as absent', async () => {
  const fixture = await setupFixture();
  const output: string[] = [];
  const calls: Array<{ command: string; args: string[] }> = [];
  const runtime = runtimeDependencies(fixture, output, {}, {
    runCommand: async (command, args) => {
      calls.push({ command, args });
      return { status: 0, stdout: 'existing registration', stderr: '' };
    },
  });

  assert.equal(await runCli(['mcp', 'install', '--client', 'claude'], runtime), 2);
  assert.deepEqual(calls, [{ command: 'claude', args: ['mcp', 'get', 'kooyahq'] }]);
  assert.match(output.join('\n'), /existing kooyahq.*cannot be verified safely/i);
});

test('local client setup reports missing client targets without writing a JSON registration', async () => {
  const fixture = await setupFixture();
  const output: string[] = [];
  const missing = new Error('spawn claude ENOENT');
  Object.assign(missing, { code: 'ENOENT' });
  const commandRuntime = runtimeDependencies(fixture, output, {}, {
    runCommand: async () => { throw missing; },
  });
  assert.equal(await runCli(['mcp', 'install', '--client', 'claude'], commandRuntime), 2);
  assert.match(output.join('\n'), /Claude Code CLI was not found/i);

  output.length = 0;
  const missingNode = join(fixture.home, 'missing-node');
  const jsonRuntime = runtimeDependencies(fixture, output, {}, { nodeExecutable: missingNode });
  assert.equal(await runCli(['mcp', 'install', '--client', 'gemini'], jsonRuntime), 2);
  await assert.rejects(readFile(join(fixture.home, '.gemini', 'settings.json')), { code: 'ENOENT' });
  assert.match(output.join('\n'), /target is missing/i);
});

test('root and MCP help list every supported local client and reject other client names', async () => {
  const fixture = await setupFixture();
  const output: string[] = [];
  const runtime = runtimeDependencies(fixture, output);
  const clients = ['codex', 'cursor', 'claude', 'gemini', 'antigravity', 'openclaw', 'hermes'];

  assert.equal(await runCli(['--help'], runtime), 0);
  for (const client of clients) assert.match(output.join('\n'), new RegExp(client));

  output.length = 0;
  assert.equal(await runCli(['mcp', '--help'], runtime), 0);
  for (const client of clients) assert.match(output.join('\n'), new RegExp(client));

  output.length = 0;
  assert.equal(await runCli(['mcp', 'install', '--client', 'unknown'], runtime), 2);
  assert.match(output.join('\n'), /codex\|cursor\|claude\|gemini\|antigravity\|openclaw\|hermes/);
});

test('Codex installer uses absolute MCP targets, preserves other skills, and is idempotent', async () => {
  const fixture = await setupFixture();
  const calls: string[][] = [];
  let registered = false;
  const runCommand: SetupDependencies['runCommand'] = async (_command, args) => {
    calls.push(args);
    if (args[1] === 'get') {
      return registered
        ? {
          status: 0,
          stdout: codexServerJson(
            fixture.dependencies.nodeExecutable,
            join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js'),
          ),
          stderr: '',
        }
        : codexMissingResult();
    }
    if (args[1] === 'add') registered = true;
    return { status: args[1] === 'remove' ? 1 : 0, stdout: '', stderr: '' };
  };

  await installCodexIntegration({ ...fixture.dependencies, runCommand });
  await installCodexIntegration({ ...fixture.dependencies, runCommand });

  const expectedScript = join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js');
  const additions = calls.filter((args) => args[1] === 'add');
  assert.deepEqual(additions[0], [
    'mcp', 'add', 'kooyahq', '--', fixture.dependencies.nodeExecutable, expectedScript,
  ]);
  assert.equal(additions.length, 1);
  assert.equal(
    await readFile(join(fixture.home, '.codex', 'skills', 'kooyahq-cli', 'VERSION'), 'utf8'),
    '0.3.0\n',
  );
  assert.equal(
    await readFile(join(fixture.home, '.codex', 'skills', 'kooyahq-workflow', 'sentinel'), 'utf8'),
    'preserve',
  );
});

test('packaged skill makes the live project catalog a hard gate for mutations', async () => {
  const fixture = await setupFixture();
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const skillRoot = join(fixture.home, '.codex', 'skills');

  await installSkill(packageRoot, skillRoot);

  const skill = await readFile(join(skillRoot, 'kooyahq-cli', 'SKILL.md'), 'utf8');
  const mcpGuide = await readFile(join(packageRoot, 'docs', 'codex-mcp.md'), 'utf8');
  const readme = await readFile(join(packageRoot, 'README.md'), 'utf8');
  assert.match(skill, /## Company-internal project gate/);
  assert.match(skill, /Before any KooyaHQ mutation, run `kooyahq projects list --all --output json`/);
  assert.match(skill, /If no exact project display name matches the work, do not create, update, move, comment on, or time-track anything/);
  assert.match(skill, /top-level `project`.*exact live project display name/i);
  assert.match(skill, /`projects create`.*rejected/i);
  assert.match(mcpGuide, /## Company-internal project gate/);
  assert.match(readme, /## Company-internal project gate/);
});

test('Codex installer leaves an exact registration with advanced settings unchanged', async () => {
  const fixture = await setupFixture();
  const calls: string[][] = [];
  const scriptPath = join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js');
  await installCodexIntegration({
    ...fixture.dependencies,
    runCommand: async (_command, args) => {
      calls.push(args);
      return {
        status: 0,
        stdout: JSON.stringify({
          name: 'kooyahq',
          enabled: true,
          enabled_tools: ['kooyahq_status'],
          startup_timeout_sec: 20,
          transport: {
            type: 'stdio',
            command: fixture.dependencies.nodeExecutable,
            args: [scriptPath],
            env: null,
            env_vars: ['KOOYAHQ_PROFILE'],
            cwd: fixture.packageRoot,
          },
        }),
        stderr: '',
      };
    },
  });

  assert.deepEqual(calls.map((args) => args[1]), ['get']);
  assert.equal(
    (await readFile(join(fixture.home, '.codex', 'skills', 'kooyahq-cli', 'VERSION'), 'utf8')).trim(),
    '0.3.0',
  );
});

test('Codex setup reports a missing CLI and a failed rollback explicitly', async () => {
  const fixture = await setupFixture();
  const missing = new Error('spawn codex ENOENT');
  Object.assign(missing, { code: 'ENOENT' });
  await assert.rejects(
    installCodexIntegration({
      ...fixture.dependencies,
      runCommand: async () => { throw missing; },
    }),
    /Codex CLI was not found/i,
  );

  const report = await doctorCodexIntegration({
    ...fixture.dependencies,
    runCommand: async () => { throw missing; },
  }, false);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report), /Codex CLI was not found/i);

  const previous = JSON.stringify({
    name: 'kooyahq',
    transport: { type: 'stdio', command: '/old/node', args: ['/old/server.js'], env: null },
  });
  await assert.rejects(
    installCodexIntegration({
      ...fixture.dependencies,
      runCommand: async (_command, args) => {
        if (args[1] === 'get') return { status: 0, stdout: previous, stderr: '' };
        if (args[1] === 'remove') return { status: 0, stdout: '', stderr: '' };
        return { status: 1, stdout: '', stderr: 'failed' };
      },
    }),
    /unable to restore the previous kooyahq entry/i,
  );
});

test('Codex installer aborts before mutation on ambiguous reads or unrestorable settings', async () => {
  const fixture = await setupFixture();
  for (const getResult of [
    { status: 2, stdout: '', stderr: 'permission denied' },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq',
        enabled: false,
        transport: { type: 'stdio', command: '/old/node', args: [], env: null, env_vars: [] },
      }),
      stderr: '',
    },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq', enabled: true, startup_timeout_sec: 5,
        transport: { type: 'stdio', command: '/old/node', args: [], env: null, env_vars: [] },
      }),
      stderr: '',
    },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq', enabled: true, oauth_client_id: 'unsupported',
        transport: { type: 'stdio', command: '/old/node', args: [], env: null, env_vars: [] },
      }),
      stderr: '',
    },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq', enabled: true,
        transport: {
          type: 'stdio', command: '/old/node', args: [], env: null, env_vars: ['TOKEN'], cwd: null,
        },
      }),
      stderr: '',
    },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq', enabled: true,
        transport: {
          type: 'streamable_http', url: 'https://example.com/mcp',
          http_headers: { Authorization: 'fixed' }, env_http_headers: null,
        },
      }),
      stderr: '',
    },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq',
        enabled: true,
        enabled_tools: ['one'],
        transport: { type: 'stdio', command: '/old/node', args: [], env: null, env_vars: [] },
      }),
      stderr: '',
    },
    {
      status: 0,
      stdout: JSON.stringify({
        name: 'kooyahq',
        enabled: true,
        transport: {
          type: 'stdio', command: '/old/node', args: [], env: null, env_vars: [], cwd: '/tmp',
        },
      }),
      stderr: '',
    },
  ]) {
    const calls: string[][] = [];
    await assert.rejects(installCodexIntegration({
      ...fixture.dependencies,
      runCommand: async (_command, args) => {
        calls.push(args);
        return getResult;
      },
    }), /read|restore|unsupported/i);
    assert.deepEqual(calls.map((args) => args[1]), ['get']);
  }

  const doctor = await doctorCodexIntegration({
    ...fixture.dependencies,
    runCommand: async () => ({ status: 2, stdout: '', stderr: 'permission denied' }),
  }, false);
  assert.match(JSON.stringify(doctor), /could not be read safely/i);
});

test('Codex rollback preserves supported stdio environment and HTTP bearer settings', async () => {
  const fixture = await setupFixture();
  for (const scenario of [
    {
      server: {
        name: 'kooyahq',
        enabled: true,
        transport: {
          type: 'stdio', command: '/old/node', args: ['/old/server.js'], env: { KEEP: 'yes' },
          env_vars: [], cwd: null,
        },
      },
      restored: 'mcp add --env KEEP=yes kooyahq -- /old/node /old/server.js',
    },
    {
      server: {
        name: 'kooyahq',
        enabled: true,
        transport: {
          type: 'streamable_http', url: 'https://example.com/mcp',
          bearer_token_env_var: 'MCP_TOKEN', http_headers: null, env_http_headers: null,
        },
      },
      restored: 'mcp add kooyahq --url https://example.com/mcp --bearer-token-env-var MCP_TOKEN',
    },
  ]) {
    const calls: string[][] = [];
    let additions = 0;
    await assert.rejects(installCodexIntegration({
      ...fixture.dependencies,
      runCommand: async (_command, args) => {
        calls.push(args);
        if (args[1] === 'get') {
          return { status: 0, stdout: JSON.stringify(scenario.server), stderr: '' };
        }
        if (args[1] === 'add') {
          additions += 1;
          return { status: additions === 1 ? 1 : 0, stdout: '', stderr: '' };
        }
        return { status: 0, stdout: '', stderr: '' };
      },
    }), /register KooyaHQ MCP/i);
    assert.ok(calls.some((args) => args.join(' ') === scenario.restored));
  }
});

test('Codex installer treats only the exact not-found response as an absent entry', async () => {
  const fixture = await setupFixture();
  const calls: string[][] = [];
  await installCodexIntegration({
    ...fixture.dependencies,
    runCommand: async (_command, args) => {
      calls.push(args);
      if (args[1] === 'get') {
        return {
          status: 1,
          stdout: '',
          stderr: "Error: No MCP server named 'kooyahq' found.\n",
        };
      }
      return { status: args[1] === 'remove' ? 1 : 0, stdout: '', stderr: '' };
    },
  });
  assert.ok(calls.some((args) => args[1] === 'add'));
});

test('custom CODEX_HOME is absolute and shared by skill install and doctor', async () => {
  const fixture = await setupFixture();
  const customRoot = join(fixture.home, 'custom-codex');
  const output: string[] = [];
  const runtime = runtimeDependencies(fixture, output, {
    CODEX_HOME: customRoot,
  });
  assert.equal(await runCli(['mcp', 'install', '--client', 'codex'], runtime), 0);
  assert.equal(
    (await readFile(join(customRoot, 'skills', 'kooyahq-cli', 'VERSION'), 'utf8')).trim(),
    '0.3.0',
  );

  const invalid = runtimeDependencies(fixture, [], { CODEX_HOME: 'relative/codex' });
  assert.equal(await runCli(['mcp', 'install', '--client', 'codex'], invalid), 2);
});

test('Codex executable selection launches the Windows cmd shim through a shell', () => {
  assert.equal(codexExecutable('win32'), 'codex.cmd');
  assert.equal(codexExecutable('linux'), 'codex');
  assert.equal(commandRequiresShell('win32', 'codex.cmd'), true);
  assert.equal(commandRequiresShell('linux', 'codex'), false);
});

test('skill publisher recovers a stale lock, keeps the target directory, and publishes VERSION last', async () => {
  const fixture = await setupFixture();
  const skillRoot = join(fixture.home, '.codex', 'skills');
  const target = join(skillRoot, 'kooyahq-cli');
  const lock = join(skillRoot, '.kooyahq-cli-install.lock');
  await mkdir(lock, { recursive: true });
  const old = new Date(Date.now() - 60_000);
  await utimes(lock, old, old);
  const published: string[] = [];
  await installSkill(fixture.packageRoot, skillRoot, {
    staleLockMs: 10,
    waitTimeoutMs: 100,
    retryMs: 5,
    beforePublish: async (relativePath) => {
      assert.equal((await stat(target)).isDirectory(), true);
      published.push(relativePath);
    },
  });
  assert.equal(published.at(-1), 'VERSION');
});

test('skill publisher rolls back replaced files and serializes concurrent installers', async () => {
  const fixture = await setupFixture();
  const skillRoot = join(fixture.home, '.codex', 'skills');
  const target = join(skillRoot, 'kooyahq-cli');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'SKILL.md'), 'old-skill');
  await writeFile(join(target, 'VERSION'), 'old-version');
  await writeFile(join(target, 'obsolete.txt'), 'remove-me');
  await mkdir(join(target, 'obsolete-dir'));
  await writeFile(join(target, 'obsolete-dir', 'asset.txt'), 'remove-me');

  await assert.rejects(installSkill(fixture.packageRoot, skillRoot, {
    beforePublish: async (relativePath) => {
      if (relativePath === 'VERSION') throw new Error('publish failure');
    },
  }), /publish failure/);
  assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), 'old-skill');
  assert.equal(await readFile(join(target, 'VERSION'), 'utf8'), 'old-version');

  await Promise.all([
    installSkill(fixture.packageRoot, skillRoot, { retryMs: 5 }),
    installSkill(fixture.packageRoot, skillRoot, { retryMs: 5 }),
  ]);
  assert.equal((await readFile(join(target, 'VERSION'), 'utf8')).trim(), '0.3.0');
  assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /KooyaHQ CLI/);
  await assert.rejects(stat(join(target, 'obsolete.txt')), { code: 'ENOENT' });
  await assert.rejects(stat(join(target, 'obsolete-dir')), { code: 'ENOENT' });
});

test('Codex installer restores the previous kooyahq entry when replacement fails', async () => {
  const fixture = await setupFixture();
  const calls: string[][] = [];
  const previous = JSON.stringify({
    name: 'kooyahq',
    transport: { type: 'stdio', command: '/old/node', args: ['/old/server.js'], env: null },
  });
  let additions = 0;

  await assert.rejects(
    installCodexIntegration({
      ...fixture.dependencies,
      runCommand: async (_command, args) => {
        calls.push(args);
        if (args[1] === 'get') return { status: 0, stdout: previous, stderr: '' };
        if (args[1] === 'add') {
          additions += 1;
          return additions === 1
            ? { status: 1, stdout: '', stderr: 'replacement failed' }
            : { status: 0, stdout: '', stderr: '' };
        }
        return { status: 0, stdout: '', stderr: '' };
      },
    }),
    /register KooyaHQ MCP/i,
  );

  assert.ok(calls.some((args) => args.join(' ') === 'mcp add kooyahq -- /old/node /old/server.js'));
  assert.equal(
    await readFile(join(fixture.home, '.codex', 'skills', 'kooyahq-workflow', 'sentinel'), 'utf8'),
    'preserve',
  );
});

test('Codex doctor verifies registration, handshake, tool list, skill, and optional online status', async () => {
  const fixture = await setupFixture();
  await installCodexIntegration({
    ...fixture.dependencies,
    runCommand: async (_command, args) => ({
      ...(args[1] === 'get'
        ? codexMissingResult()
        : { status: 0, stdout: '', stderr: '' }),
    }),
  });
  let onlineCalls = 0;
  const dependencies: SetupDependencies = {
    ...fixture.dependencies,
    runCommand: async (_command, args) => ({
      status: 0,
      stdout: args.includes('get')
        ? codexServerJson(
          fixture.dependencies.nodeExecutable,
          join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js'),
        )
        : '',
      stderr: '',
    }),
    probeMcp: async () => ({
      protocolVersion: '2025-06-18',
      tools: ['kooyahq_status', 'kooyahq_discover', 'kooyahq_call'],
    }),
    onlineCheck: async () => {
      onlineCalls += 1;
      return true;
    },
  };

  const offline = await doctorCodexIntegration(dependencies, false);
  assert.equal(offline.ok, true);
  assert.equal(onlineCalls, 0);
  assert.ok(offline.checks.every((check) => check.ok));

  const online = await doctorCodexIntegration(dependencies, true);
  assert.equal(online.ok, true);
  assert.equal(onlineCalls, 1);
  assert.match(JSON.stringify(online), /authenticated KooyaHQ profile/i);
  assert.doesNotMatch(JSON.stringify(online), /secret/i);
});

test('CLI exposes offline Codex MCP install and doctor commands with restart guidance', async () => {
  const fixture = await setupFixture();
  const output: string[] = [];
  const runtime = runtimeDependencies(fixture, output);

  assert.equal(await runCli(['mcp', 'install', '--client', 'codex'], runtime), 0);
  assert.match(output.join('\n'), /restart Codex.*new thread/i);
  output.length = 0;
  assert.equal(await runCli(['mcp', 'doctor', '--client', 'codex'], runtime), 0);
  assert.match(output.join('\n'), /MCP handshake/i);
});

async function setupFixture(): Promise<{
  home: string;
  packageRoot: string;
  dependencies: SetupDependencies;
}> {
  const root = await mkdtemp(join(tmpdir(), 'kooyahq-mcp-setup-'));
  const home = join(root, 'home');
  const packageRoot = join(root, 'package');
  const mcpScript = join(packageRoot, 'dist', 'bin', 'kooyahq-mcp.js');
  await mkdir(join(packageRoot, 'skills', 'kooyahq-cli'), { recursive: true });
  await mkdir(join(packageRoot, 'dist', 'bin'), { recursive: true });
  await mkdir(join(home, '.codex', 'skills', 'kooyahq-workflow'), { recursive: true });
  await writeFile(join(packageRoot, 'skills', 'kooyahq-cli', 'SKILL.md'), '# KooyaHQ CLI\n');
  await writeFile(join(packageRoot, 'skills', 'kooyahq-cli', 'VERSION'), '0.3.0\n');
  await writeFile(mcpScript, '#!/usr/bin/env node\n');
  await chmod(mcpScript, 0o755);
  await writeFile(join(home, '.codex', 'skills', 'kooyahq-workflow', 'sentinel'), 'preserve');
  return {
    home,
    packageRoot,
    dependencies: {
      homeDirectory: home,
      codexRoot: join(home, '.codex'),
      codexCommand: 'codex',
      claudeCommand: 'claude',
      openclawCommand: 'openclaw',
      hermesCommand: 'hermes',
      platform: 'linux',
      packageRoot,
      version: '0.3.0',
      nodeExecutable: process.execPath,
      environment: {},
      runCommand: async () => ({ status: 0, stdout: '', stderr: '' }),
      probeMcp: async () => ({ protocolVersion: '2025-06-18', tools: [] }),
      onlineCheck: async () => true,
    },
  };
}

function runtimeDependencies(
  fixture: Awaited<ReturnType<typeof setupFixture>>,
  output: string[],
  environment: NodeJS.ProcessEnv = {},
  mcpSetup: SetupOverrides = {},
): RuntimeDependencies {
  return {
    environment,
    homeDirectory: fixture.home,
    platform: 'linux',
    version: '0.3.0',
    fetch: async () => { throw new Error('network must not be called'); },
    prompt: async () => '',
    readInputFile: async () => { throw new Error('file must not be read'); },
    readStandardInput: async () => { throw new Error('stdin must not be read'); },
    output: { stdout: (value) => output.push(value), stderr: (value) => output.push(value) },
    mcpSetup: {
      packageRoot: fixture.packageRoot,
      nodeExecutable: process.execPath,
      runCommand: async (_command, args) => ({
        status: 0,
        stdout: args.includes('get')
          ? codexServerJson(
            process.execPath,
            join(fixture.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js'),
          )
          : '',
        stderr: '',
      }),
      probeMcp: async () => ({
        protocolVersion: '2025-06-18',
        tools: ['kooyahq_status', 'kooyahq_discover', 'kooyahq_call'],
      }),
      ...mcpSetup,
    },
  };
}

function codexServerJson(command: string, scriptPath: string): string {
  return JSON.stringify({
    name: 'kooyahq',
    transport: { type: 'stdio', command, args: [scriptPath], env: null },
  });
}

function codexMissingResult(): { status: number; stdout: string; stderr: string } {
  return {
    status: 1,
    stdout: '',
    stderr: "Error: No MCP server named 'kooyahq' found.\n",
  };
}

function claudeMissingResult(): { status: number; stdout: string; stderr: string } {
  return {
    status: 1,
    stdout: '',
    stderr: 'No MCP server named "kooyahq". Run `claude mcp add` to add one.\n',
  };
}
