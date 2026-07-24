import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { ConfigError, ValidationError } from '../core/errors.js';
import type { Credentials } from './types.js';
import { validateBaseUrl } from './url.js';

function validateStoredConfig(value: unknown): Credentials {
  if (!value || typeof value !== 'object') {
    throw new ConfigError('Stored configuration is not a JSON object.');
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.baseUrl !== 'string' ||
    typeof candidate.accessKeyId !== 'string' ||
    typeof candidate.secretAccessKey !== 'string' ||
    !candidate.accessKeyId.trim() ||
    !candidate.secretAccessKey.trim()
  ) {
    throw new ConfigError('Stored configuration is incomplete. Run `kooyahq configure`.');
  }
  try {
    return {
      baseUrl: validateBaseUrl(candidate.baseUrl),
      accessKeyId: candidate.accessKeyId.trim(),
      secretAccessKey: candidate.secretAccessKey.trim(),
    };
  } catch (error) {
    if (error instanceof ValidationError) throw new ConfigError(error.message);
    throw error;
  }
}

export async function readConfig(path: string): Promise<Credentials | undefined> {
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new ConfigError('Unable to read the KooyaHQ configuration file.');
  }
  try {
    return validateStoredConfig(JSON.parse(content));
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('Stored configuration is not valid JSON.');
  }
}

export async function writeConfig(
  path: string,
  credentials: Credentials,
  platform: NodeJS.Platform,
): Promise<void> {
  const validated = validateStoredConfig(credentials);
  const directory = dirname(path);
  const temporaryPath = join(directory, `.config-${randomUUID()}.tmp`);
  const privateModes = platform === 'win32' ? {} : { mode: 0o700 };
  await mkdir(directory, { recursive: true, ...privateModes });
  if (platform !== 'win32') await chmod(directory, 0o700);
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', platform === 'win32' ? undefined : 0o600);
    await handle.writeFile(`${JSON.stringify(validated, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
  } catch {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw new ConfigError('Unable to save the KooyaHQ configuration file.');
  }
}

export async function clearConfig(path: string): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch {
    throw new ConfigError('Unable to clear the KooyaHQ configuration file.');
  }
}
