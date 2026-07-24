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
import { formatOutput } from '../output/format.js';
import { helpText } from './help.js';

export interface RuntimeDependencies {
  environment: NodeJS.ProcessEnv;
  homeDirectory: string;
  platform: NodeJS.Platform;
  version: string;
  fetch: typeof globalThis.fetch;
  prompt: (question: string, hidden?: boolean) => Promise<string>;
  output: {
    stdout: (value: string) => void;
    stderr: (value: string) => void;
  };
}

export function defaultDependencies(
  version: string,
  prompt: RuntimeDependencies['prompt'],
): RuntimeDependencies {
  return {
    environment: process.env,
    homeDirectory: homedir(),
    platform: process.platform,
    version,
    fetch: globalThis.fetch,
    prompt,
    output: {
      stdout: (value) => process.stdout.write(`${value}\n`),
      stderr: (value) => process.stderr.write(`${value}\n`),
    },
  };
}

export async function runCli(argv: string[], dependencies: RuntimeDependencies): Promise<number> {
  try {
    if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
      dependencies.output.stdout(helpText());
      return 0;
    }
    if (argv[0] === '--version' || argv[0] === '-v') {
      dependencies.output.stdout(dependencies.version);
      return 0;
    }
    if (argv[0] === 'configure') return await runConfigure(argv.slice(1), dependencies);

    const request = buildRequest(commandCatalog, argv);
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
    const result = await client.request(request.method, request.path, {
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
    fetch: dependencies.fetch,
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
  request.path = request.path.replace(`:${positional}`, encodeURIComponent(timerId));
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).data)) {
    return (value as { data: unknown[] }).data;
  }
  return [];
}
