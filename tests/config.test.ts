import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { resolveCredentialsFromEnv } from '../src/config/env.js';
import { configPathFor } from '../src/config/paths.js';
import { readConfig, windowsPrivateAclCommands, writeConfig } from '../src/config/store.js';
import { DEFAULT_BASE_URL, validateBaseUrl } from '../src/config/url.js';
import { ValidationError } from '../src/core/errors.js';

test('uses the documented default origin and platform-specific config path', () => {
  assert.equal(DEFAULT_BASE_URL, 'https://hq-be.kooyaai.com');
  assert.equal(configPathFor('/home/sam', 'linux'), '/home/sam/.kooyahq/config.json');
  assert.equal(configPathFor('C:\\Users\\Sam', 'win32'), 'C:\\Users\\Sam\\.kooyahq\\config.json');
});

test('accepts an HTTPS origin and strips a trailing slash', () => {
  assert.equal(validateBaseUrl('https://example.com/'), 'https://example.com');
  assert.equal(validateBaseUrl('http://localhost:5001'), 'http://localhost:5001');
  assert.equal(validateBaseUrl('http://127.0.0.1:5001'), 'http://127.0.0.1:5001');
  assert.equal(validateBaseUrl('http://[::1]:5001'), 'http://[::1]:5001');
});

for (const invalid of [
  'http://example.com',
  'https://example.com/api',
  'https://user:password@example.com',
  'https://example.com?debug=true',
  'https://example.com/#fragment',
]) {
  test(`rejects unsafe base URL ${invalid}`, () => {
    assert.throws(() => validateBaseUrl(invalid), ValidationError);
  });
}

test('environment credentials are all-or-none and override as a complete set', () => {
  assert.deepEqual(
    resolveCredentialsFromEnv({
      KOOYAHQ_BASE_URL: 'https://internal.example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'key-id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    }),
    { baseUrl: 'https://internal.example.com', accessKeyId: 'key-id', secretAccessKey: 'secret' },
  );
  assert.equal(resolveCredentialsFromEnv({}), undefined);
  assert.throws(
    () => resolveCredentialsFromEnv({ KOOYAHQ_ACCESS_KEY_ID: 'key-id' }),
    /must be set together/,
  );
  assert.throws(
    () => resolveCredentialsFromEnv({
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: ' ',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    }),
    /must not be blank/,
  );
});

test('writes config atomically with private POSIX permissions', async () => {
  const home = await mkdtemp(join(tmpdir(), 'kooyahq-config-'));
  const path = configPathFor(home, 'linux');
  await writeConfig(path, {
    baseUrl: 'https://example.com',
    accessKeyId: 'key-id',
    secretAccessKey: 'secret',
  }, 'linux');

  assert.deepEqual(await readConfig(path), {
    baseUrl: 'https://example.com',
    accessKeyId: 'key-id',
    secretAccessKey: 'secret',
  });
  assert.equal((await stat(join(home, '.kooyahq'))).mode & 0o777, 0o700);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await readFile(path, 'utf8')).endsWith('\n'), true);
});

test('repairs an existing POSIX config directory to private permissions', async () => {
  const home = await mkdtemp(join(tmpdir(), 'kooyahq-config-mode-'));
  const directory = join(home, '.kooyahq');
  await mkdir(directory, { mode: 0o755 });
  await chmod(directory, 0o755);
  await writeConfig(join(directory, 'config.json'), {
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
  }, 'linux');
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
});

test('builds shell-free Windows ACL commands for the owner and SYSTEM only', () => {
  assert.deepEqual(windowsPrivateAclCommands('C:\\Users\\Sam\\.kooyahq', 'C:\\Users\\Sam\\.kooyahq\\config.json', 'DESKTOP\\Sam'), [
    ['C:\\Users\\Sam\\.kooyahq', '/inheritance:r', '/grant:r', 'DESKTOP\\Sam:(OI)(CI)F', 'SYSTEM:(OI)(CI)F'],
    ['C:\\Users\\Sam\\.kooyahq\\config.json', '/inheritance:r', '/grant:r', 'DESKTOP\\Sam:F', 'SYSTEM:F'],
  ]);
});

test('protects the Windows directory and temporary file before writing a secret', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kooyahq-windows-config-'));
  const path = join(directory, 'config.json');
  const protectedTargets: Array<string | undefined> = [];

  await writeConfig(path, {
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
  }, 'win32', {
    applyWindowsAcl: async (_directory, target) => {
      protectedTargets.push(target);
      if (target?.endsWith('.tmp')) assert.equal(await readFile(target, 'utf8'), '');
    },
  });

  assert.equal(protectedTargets[0], undefined);
  assert.ok(protectedTargets.some((target) => target?.endsWith('.tmp')));
  assert.equal(protectedTargets.at(-1), path);
  assert.equal((await readConfig(path))?.secretAccessKey, 'secret');
});

test('restores the previous Windows config if final ACL hardening fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kooyahq-windows-restore-'));
  const path = join(directory, 'config.json');
  const previous = '{"baseUrl":"https://old.example.com","accessKeyId":"old","secretAccessKey":"old-secret"}\n';
  await writeFile(path, previous, 'utf8');
  let finalPathVisits = 0;

  await assert.rejects(
    writeConfig(path, {
      baseUrl: 'https://new.example.com', accessKeyId: 'new', secretAccessKey: 'new-secret',
    }, 'win32', {
      applyWindowsAcl: async (_directory, target) => {
        if (target === path) {
          finalPathVisits += 1;
          if (finalPathVisits === 2) throw new Error('simulated ACL failure');
        }
      },
    }),
    /Unable to save/,
  );

  assert.equal(await readFile(path, 'utf8'), previous);
  assert.deepEqual(await readdir(directory), ['config.json']);
});
