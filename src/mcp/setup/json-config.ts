import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

import { ConfigError } from '../../core/errors.js';
import { localMcpEntryMatches, type LocalMcpDescriptor } from './local-client.js';

export interface JsonMcpConfig {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function readJsonMcpConfig(path: string, clientName: string): Promise<JsonMcpConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new ConfigError(`${clientName} MCP configuration could not be read safely; no changes were made.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ConfigError(`${clientName} MCP configuration is not valid JSON; no changes were made.`);
  }
  if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers))) {
    throw new ConfigError(`${clientName} MCP configuration has an unsupported structure; no changes were made.`);
  }
  return parsed;
}

export async function installJsonMcpEntry(
  path: string,
  descriptor: LocalMcpDescriptor,
  clientName: string,
): Promise<void> {
  const config = await readJsonMcpConfig(path, clientName);
  const existing = config.mcpServers?.kooyahq;
  if (existing !== undefined && !localMcpEntryMatches(existing, descriptor)) {
    throw new ConfigError(
      `${clientName} has an existing kooyahq MCP registration that cannot be verified safely; no changes were made.`,
    );
  }
  if (existing !== undefined) return;
  await writeJsonAtomic(path, {
    ...config,
    mcpServers: {
      ...(config.mcpServers ?? {}),
      kooyahq: { command: descriptor.command, args: descriptor.args },
    },
  }, clientName);
}

async function writeJsonAtomic(
  path: string,
  value: JsonMcpConfig,
  clientName: string,
): Promise<void> {
  const directory = dirname(path);
  const temporary = join(directory, `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } catch {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw new ConfigError(`${clientName} MCP configuration could not be written atomically.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
