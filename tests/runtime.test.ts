import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeConfig } from '../src/config/store.js';
import { runCli, type RuntimeDependencies } from '../src/runtime/run.js';

function dependencies(overrides: Partial<RuntimeDependencies> = {}): RuntimeDependencies {
  return {
    environment: {},
    homeDirectory: '/missing-home',
    platform: 'linux',
    version: '0.1.0',
    fetch: async () => {
      throw new Error('network must not be called');
    },
    prompt: async () => '',
    output: { stdout: () => undefined, stderr: () => undefined },
    ...overrides,
  };
}

test('does not send network traffic when credentials are missing', async () => {
  let networkCalls = 0;
  const errors: string[] = [];
  const code = await runCli(['projects', 'list'], dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
    output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
  }));
  assert.equal(code, 2);
  assert.equal(networkCalls, 0);
  assert.match(errors.join('\n'), /configure/);
});

test('maps API status failures to stable exit codes without exposing credentials', async () => {
  const cases: Array<[number, number]> = [[500, 1], [401, 3], [403, 4], [404, 5], [409, 5]];
  for (const [status, expected] of cases) {
    const errors: string[] = [];
    const code = await runCli(['auth', 'whoami'], dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'access-id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'top-secret',
      },
      fetch: async () => new Response(JSON.stringify({ message: `status ${status}` }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
      output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
    }));
    assert.equal(code, expected);
    assert.doesNotMatch(errors.join('\n'), /top-secret|access-id/);
  }
});

test('refuses to guess a timer when the eligible list is ambiguous', async () => {
  const requests: string[] = [];
  const code = await runCli(['time', 'timers', 'pause'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ data: [{ id: 't1' }, { id: 't2' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  }));
  assert.equal(code, 2);
  assert.equal(requests.length, 1);
  assert.match(requests[0]!, /\/time\/timers\?status=running$/);
});

test('uses the only eligible timer when no timer id is supplied', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const code = await runCli(['time', 'timers', 'resume'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET' });
      return requests.length === 1
        ? new Response(JSON.stringify({ data: [{ id: 'timer 1' }] }), {
          status: 200, headers: { 'content-type': 'application/json' },
        })
        : new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  }));
  assert.equal(code, 0);
  assert.deepEqual(requests, [
    { url: 'https://example.com/api/cli/v1/time/timers?status=paused', method: 'GET' },
    { url: 'https://example.com/api/cli/v1/time/timers/timer%201/resume', method: 'POST' },
  ]);
});

test('failed configure validation does not overwrite stored credentials', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'kooyahq-runtime-'));
  const configPath = join(homeDirectory, '.kooyahq', 'config.json');
  await writeConfig(configPath, {
    baseUrl: 'https://old.example.com',
    accessKeyId: 'old-id',
    secretAccessKey: 'old-secret',
  }, 'linux');
  const before = await readFile(configPath, 'utf8');
  const answers = ['https://example.com', 'new-id', 'new-secret'];
  const code = await runCli(['configure'], dependencies({
    homeDirectory,
    prompt: async () => answers.shift()!,
    fetch: async () => new Response(JSON.stringify({ message: 'invalid' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    }),
  }));
  assert.equal(code, 3);
  assert.equal(await readFile(configPath, 'utf8'), before);
});

test('configure show redacts the secret', async () => {
  const lines: string[] = [];
  const code = await runCli(['configure', 'show'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'access-id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'hidden-secret',
    },
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /\[REDACTED\]/);
  assert.doesNotMatch(lines.join('\n'), /hidden-secret/);
});

test('required create options fail before network traffic', async () => {
  let calls = 0;
  const code = await runCli(['tickets', 'create', '--title', 'Incomplete'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  }));
  assert.equal(code, 2);
  assert.equal(calls, 0);
});
