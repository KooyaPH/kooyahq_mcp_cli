import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { probeMcp, runCommandWithLimits } from '../src/mcp/setup/process.js';

const CHILD_PROCESS_STARTUP_TIMEOUT_MS = 10_000;

test('setup command removes KooyaHQ credentials from child environment', async () => {
  const result = await runCommandWithLimits(process.execPath, [
    '-e',
    'process.stdout.write(JSON.stringify({id:process.env.KOOYAHQ_ACCESS_KEY_ID,secret:process.env.KOOYAHQ_SECRET_ACCESS_KEY,keep:process.env.KEEP_ME,codexHome:process.env.CODEX_HOME}))',
  ], {
    KOOYAHQ_ACCESS_KEY_ID: 'id',
    KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    KEEP_ME: 'yes',
    CODEX_HOME: '/tmp/codex-test-home',
  }, { timeoutMs: CHILD_PROCESS_STARTUP_TIMEOUT_MS, maxOutputBytes: 1024, killGraceMs: 50 });
  assert.deepEqual(JSON.parse(result.stdout), {
    keep: 'yes',
    codexHome: '/tmp/codex-test-home',
  });
});

test('setup command bounds output and times out only after child termination', async () => {
  await assert.rejects(
    runCommandWithLimits(process.execPath, ['-e', "process.stdout.write('x'.repeat(2048));setInterval(()=>{},1000)"], {}, {
      timeoutMs: 2_000,
      maxOutputBytes: 1024,
      killGraceMs: 25,
    }),
    /output limit/i,
  );
  const started = Date.now();
  await assert.rejects(
    runCommandWithLimits(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {}, {
      timeoutMs: 50,
      maxOutputBytes: 1024,
      killGraceMs: 25,
    }),
    /timed out/i,
  );
  assert.ok(Date.now() - started >= 50);
});

test('MCP probe bounds stdout before a newline is received', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kooyahq-mcp-probe-'));
  const script = join(root, 'no-newline.mjs');
  await writeFile(script, "process.stdout.write('x'.repeat(1024 * 1024 + 1)); setInterval(() => {}, 1000);\n");

  await assert.rejects(probeMcp(process.execPath, script, {}), /output limit/i);
});

test('Windows command invocation rejects expansion-prone arguments before spawning', async () => {
  await assert.rejects(
    runCommandWithLimits('codex.cmd', ['mcp', 'add', '100%unsafe'], {}, {
      timeoutMs: 100,
      maxOutputBytes: 1024,
      killGraceMs: 25,
    }, 'win32'),
    /expansion-prone/i,
  );
});

test('Windows command invocation preserves spaces and quoted metacharacters', {
  skip: process.platform !== 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'kooyahq cmd shim '));
  const capture = join(root, 'capture.mjs');
  const shim = join(root, 'test shim.cmd');
  await writeFile(capture, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
  await writeFile(shim, `@echo off\r\n"${process.execPath}" "%~dp0capture.mjs" %*\r\n`);

  const result = await runCommandWithLimits(shim, ['value with spaces', 'ampersand & value'], {
    ...process.env,
  }, { timeoutMs: 2_000, maxOutputBytes: 1024, killGraceMs: 50 });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), ['value with spaces', 'ampersand & value']);
});
