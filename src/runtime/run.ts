import { homedir } from 'node:os';

import { commandCatalog } from '../commands/catalog.js';
import { buildRequest } from '../commands/request.js';
import type { CommandRequest } from '../commands/types.js';
import { resolveCredentialsFromEnv } from '../config/env.js';
import { configPathFor } from '../config/paths.js';
import { clearConfig, readConfig, writeConfig } from '../config/store.js';
import type { Credentials } from '../config/types.js';
import { DEFAULT_BASE_URL, validateBaseUrl } from '../config/url.js';
import { CliError, ConfigError, publicErrorMessage, ValidationError } from '../core/errors.js';
import { ApiClient } from '../http/client.js';
import { readBoundedFile, readBoundedStdin } from '../input/read-bounded.js';
import { parseTicketImport } from '../input/ticket-import.js';
import { formatOutput } from '../output/format.js';
import { helpText } from './help.js';
import { skillOutput } from './skill.js';

export interface RuntimeDependencies {
  environment: NodeJS.ProcessEnv;
  homeDirectory: string;
  platform: NodeJS.Platform;
  version: string;
  fetch?: typeof globalThis.fetch;
  prompt: (question: string, hidden?: boolean) => Promise<string>;
  readInputFile: (path: string, maxBytes: number) => Promise<Uint8Array>;
  readStandardInput: (maxBytes: number) => Promise<Uint8Array>;
  allPagesLimits?: AllPagesLimits;
  output: {
    stdout: (value: string) => void;
    stderr: (value: string) => void;
  };
}

export interface AllPagesLimits {
  maxPages: number;
  maxItems: number;
  maxBytes: number;
}

const DEFAULT_ALL_PAGES_LIMITS: AllPagesLimits = {
  maxPages: 1_000,
  maxItems: 100_000,
  maxBytes: 50 * 1024 * 1024,
};

export function defaultDependencies(
  version: string,
  prompt: RuntimeDependencies['prompt'],
): RuntimeDependencies {
  return {
    environment: process.env,
    homeDirectory: homedir(),
    platform: process.platform,
    version,
    prompt,
    readInputFile: readBoundedFile,
    readStandardInput: readBoundedStdin,
    output: {
      stdout: (value) => process.stdout.write(`${value}\n`),
      stderr: (value) => process.stderr.write(`${value}\n`),
    },
  };
}

export async function runCli(argv: string[], dependencies: RuntimeDependencies): Promise<number> {
  try {
    const helpIndex = argv.findIndex((token) => token === '--help' || token === '-h');
    if (argv.length === 0 || helpIndex !== -1) {
      const scope = helpIndex === -1 ? [] : resolveHelpScope(argv.slice(0, helpIndex));
      dependencies.output.stdout(helpText(scope));
      return 0;
    }
    if (argv[0] === '--version' || argv[0] === '-v') {
      dependencies.output.stdout(dependencies.version);
      return 0;
    }
    if (argv[0] === '--skill') {
      dependencies.output.stdout(skillOutput(argv.slice(1)));
      return 0;
    }
    if (argv[0] === 'configure') return await runConfigure(argv.slice(1), dependencies);

    const request = buildRequest(commandCatalog, argv);
    await materializeFileInput(request, dependencies);
    for (const warning of request.warnings ?? []) dependencies.output.stderr(`Warning: ${warning}`);
    if (request.dryRun) {
      dependencies.output.stdout(JSON.stringify({
        method: request.method,
        path: request.path,
        query: request.query,
        ...(request.body === undefined ? {} : { body: request.body }),
      }, null, 2));
      return 0;
    }
    const credentials = await resolveCredentials(dependencies);
    const client = createClient(credentials, dependencies);
    await resolveTimerIfNeeded(request, client);
    if (request.confirmation) {
      const answer = (await dependencies.prompt(`${request.confirmation} [y/N]`)).trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') {
        dependencies.output.stdout('Cancelled.');
        return 0;
      }
    }
    const result = request.all
      ? await requestAllPages(client, request, dependencies.allPagesLimits ?? DEFAULT_ALL_PAGES_LIMITS)
      : await client.request(request.method, request.path, {
        query: request.query,
        ...(request.body === undefined ? {} : { body: request.body }),
      });
    dependencies.output.stdout(formatOutput(result, request.output));
    return 0;
  } catch (error) {
    dependencies.output.stderr(publicErrorMessage(error));
    return error instanceof CliError ? error.exitCode : 1;
  }
}

function resolveHelpScope(argv: string[]): string[] {
  const command = commandCatalog
    .map((candidate) => candidate.name.split(' '))
    .filter((tokens) => tokens.every((token, index) => argv[index] === token))
    .sort((left, right) => right.length - left.length)[0];
  if (command) return command;

  const group = argv[0];
  if (group && commandCatalog.some((candidate) => candidate.name.startsWith(`${group} `))) {
    return [group];
  }
  return argv;
}

async function materializeFileInput(
  request: CommandRequest,
  dependencies: RuntimeDependencies,
): Promise<void> {
  if (!request.fileInput) return;
  const input = request.fileInput.path
    ? await dependencies.readInputFile(request.fileInput.path, request.fileInput.maxBytes)
    : await dependencies.readStandardInput(request.fileInput.maxBytes);
  const tickets = parseTicketImport(
    input,
    request.fileInput.format,
    request.fileInput.maxBytes,
    request.fileInput.maxItems,
  );
  request.body = { ...request.body, [request.fileInput.bodyName]: tickets };
}

async function requestAllPages(
  client: ApiClient,
  request: CommandRequest,
  limits: AllPagesLimits,
): Promise<unknown> {
  const requestedLimit = request.query.limit;
  const limit = typeof requestedLimit === 'number' ? requestedLimit : 100;
  const combined: unknown[] = [];
  let combinedBytes = 0;
  let firstResponse: unknown;

  for (let page = 1; page <= limits.maxPages; page += 1) {
    const response = await client.request(request.method, request.path, {
      query: { ...request.query, page, limit },
    });
    if (page === 1) firstResponse = response;
    const items = extractList(response);
    if (combined.length + items.length > limits.maxItems) {
      throw new ValidationError(`Pagination exceeded the ${limits.maxItems}-item safety limit.`);
    }
    combinedBytes += Buffer.byteLength(JSON.stringify(items));
    if (combinedBytes > limits.maxBytes) {
      throw new ValidationError(`Pagination exceeded the ${limits.maxBytes}-byte safety limit.`);
    }
    for (const item of items) combined.push(item);
    const totalPages = extractTotalPages(response);
    if (totalPages !== undefined ? page >= totalPages : items.length < limit) {
      return combinePages(firstResponse, combined);
    }
  }
  throw new ValidationError(`Pagination exceeded the ${limits.maxPages}-page safety limit.`);
}

function extractTotalPages(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const pagination = record.pagination
    ?? (record.meta && typeof record.meta === 'object'
      ? (record.meta as Record<string, unknown>).pagination
      : undefined);
  if (!pagination || typeof pagination !== 'object') return undefined;
  const paginationRecord = pagination as Record<string, unknown>;
  const totalPages = paginationRecord.totalPages ?? paginationRecord.pages;
  return typeof totalPages === 'number' && Number.isSafeInteger(totalPages) && totalPages > 0
    ? totalPages
    : undefined;
}

function combinePages(firstResponse: unknown, data: unknown[]): unknown {
  if (Array.isArray(firstResponse)) return data;
  if (!firstResponse || typeof firstResponse !== 'object') return data;
  const record = firstResponse as Record<string, unknown>;
  const pagination = record.pagination && typeof record.pagination === 'object'
    ? record.pagination as Record<string, unknown>
    : {};
  return {
    ...record,
    data,
    pagination: {
      ...pagination,
      page: 1,
      total: data.length,
      pages: 1,
      totalPages: 1,
      all: true,
    },
  };
}

async function runConfigure(argv: string[], dependencies: RuntimeDependencies): Promise<number> {
  const path = configPathFor(dependencies.homeDirectory, dependencies.platform);
  if (argv[0] === 'show') {
    if (argv.length !== 1) throw new ValidationError('Usage: kooyahq configure show');
    const credentials = resolveCredentialsFromEnv(dependencies.environment) ?? await readConfig(path);
    if (!credentials) throw new ConfigError('KooyaHQ is not configured. Run `kooyahq configure`.');
    dependencies.output.stdout(JSON.stringify({
      baseUrl: credentials.baseUrl,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: '[REDACTED]',
    }, null, 2));
    return 0;
  }
  if (argv[0] === 'clear') {
    if (argv.length !== 1) throw new ValidationError('Usage: kooyahq configure clear');
    await clearConfig(path);
    dependencies.output.stdout('Stored KooyaHQ configuration cleared.');
    return 0;
  }
  if (argv.length !== 0) {
    throw new ValidationError('Configuration does not accept flags. The secret is entered by hidden prompt only.');
  }

  const requestedBaseUrl = (await dependencies.prompt(`Base URL [${DEFAULT_BASE_URL}]`)).trim();
  const accessKeyId = (await dependencies.prompt('Access key ID')).trim();
  const secretAccessKey = (await dependencies.prompt('Secret access key', true)).trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new ValidationError('Access key ID and secret access key must not be blank.');
  }
  const candidate: Credentials = {
    baseUrl: validateBaseUrl(requestedBaseUrl || DEFAULT_BASE_URL),
    accessKeyId,
    secretAccessKey,
  };
  const client = createClient(candidate, dependencies);
  await client.request('GET', '/whoami');
  await writeConfig(path, candidate, dependencies.platform);
  dependencies.output.stdout('KooyaHQ credentials validated and saved.');
  return 0;
}

async function resolveCredentials(dependencies: RuntimeDependencies): Promise<Credentials> {
  const fromEnvironment = resolveCredentialsFromEnv(dependencies.environment);
  if (fromEnvironment) return fromEnvironment;
  const path = configPathFor(dependencies.homeDirectory, dependencies.platform);
  const stored = await readConfig(path);
  if (!stored) throw new ConfigError('KooyaHQ is not configured. Run `kooyahq configure`.');
  return stored;
}

function createClient(credentials: Credentials, dependencies: RuntimeDependencies): ApiClient {
  return new ApiClient({
    ...credentials,
    version: dependencies.version,
    platform: dependencies.platform,
    nodeVersion: process.versions.node,
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
  });
}

async function resolveTimerIfNeeded(request: CommandRequest, client: ApiClient): Promise<void> {
  if (!request.timerEligibility || !request.positionalValues) return;
  const { positional, status } = request.timerEligibility;
  if (request.positionalValues[positional]) return;
  const response = await client.request('GET', '/time/timers', { query: { status } });
  const timers = extractList(response);
  if (timers.length !== 1) {
    throw new ValidationError(
      `Found ${timers.length} eligible ${status} timers. Supply an explicit timer id.`,
    );
  }
  const timer = timers[0];
  const timerId = timer && typeof timer === 'object' ? (timer as Record<string, unknown>).id : undefined;
  if (typeof timerId !== 'string' || !timerId) {
    throw new ValidationError('The eligible timer response did not contain a usable id.');
  }
  request.path = request.path.replace(
    `:${request.timerEligibility.pathParam ?? positional}`,
    encodeURIComponent(timerId),
  );
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).data)) {
    return (value as { data: unknown[] }).data;
  }
  return [];
}
