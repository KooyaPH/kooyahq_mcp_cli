import { basename } from 'node:path';
import { homedir } from 'node:os';
import { commandCatalog } from '../commands/catalog.js';
import { buildRequest } from '../commands/request.js';
import { resolveCredentialsFromEnv } from '../config/env.js';
import { configPathFor } from '../config/paths.js';
import { clearConfig, readConfig, writeConfig } from '../config/store.js';
import { DEFAULT_BASE_URL, validateBaseUrl } from '../config/url.js';
import { CliError, ConfigError, publicErrorMessage, ValidationError } from '../core/errors.js';
import { ApiClient } from '../http/client.js';
import { readBoundedFile, readBoundedStdin } from '../input/read-bounded.js';
import { parseTicketImport } from '../input/ticket-import.js';
import { runMcpSetupCommand } from '../mcp/setup/index.js';
import { formatOutput } from '../output/format.js';
import { helpText } from './help.js';
import { skillOutput } from './skill.js';
const DEFAULT_ALL_PAGES_LIMITS = {
    maxPages: 100,
    maxItems: 100_000,
    maxBytes: 50 * 1024 * 1024,
};
export function defaultDependencies(version, prompt) {
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
export async function runCli(argv, dependencies) {
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
        if (argv[0] === 'configure')
            return await runConfigure(argv.slice(1), dependencies);
        if (argv[0] === 'mcp')
            return await runMcpSetup(argv.slice(1), dependencies);
        const request = buildRequest(commandCatalog, argv);
        await materializeFileInput(request, dependencies);
        const multipartFiles = await materializeMultipartFiles(request, dependencies);
        for (const warning of request.warnings ?? [])
            dependencies.output.stderr(`Warning: ${warning}`);
        if (request.dryRun) {
            dependencies.output.stdout(JSON.stringify({
                method: request.method,
                path: request.path,
                query: request.query,
                ...(request.body === undefined ? {} : { body: request.body }),
                ...(multipartFiles.length === 0 ? {} : {
                    multipartFiles: multipartFiles.map((file) => ({
                        fieldName: file.fieldName,
                        filename: file.filename,
                        bytes: file.bytes.byteLength,
                    })),
                }),
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
                ...(multipartFiles.length === 0 ? {} : { multipartFiles }),
            });
        dependencies.output.stdout(formatOutput(result, request.output));
        return 0;
    }
    catch (error) {
        dependencies.output.stderr(publicErrorMessage(error));
        return error instanceof CliError ? error.exitCode : 1;
    }
}
async function runMcpSetup(argv, dependencies) {
    const result = await runMcpSetupCommand(argv, {
        homeDirectory: dependencies.homeDirectory,
        version: dependencies.version,
        environment: dependencies.environment,
        platform: dependencies.platform,
        onlineCheck: async () => {
            const exitCode = await runCli(['auth', 'whoami', '--output', 'json'], {
                ...dependencies,
                output: { stdout: () => undefined, stderr: () => undefined },
            });
            return exitCode === 0;
        },
        ...(dependencies.mcpSetup ? { overrides: dependencies.mcpSetup } : {}),
    });
    for (const line of result.stdout)
        dependencies.output.stdout(line);
    for (const line of result.stderr)
        dependencies.output.stderr(line);
    return result.exitCode;
}
function resolveHelpScope(argv) {
    const command = commandCatalog
        .map((candidate) => candidate.name.split(' '))
        .filter((tokens) => tokens.every((token, index) => argv[index] === token))
        .sort((left, right) => right.length - left.length)[0];
    if (command)
        return command;
    const group = argv[0];
    if (group && commandCatalog.some((candidate) => candidate.name.startsWith(`${group} `))) {
        return [group];
    }
    return argv;
}
async function materializeFileInput(request, dependencies) {
    if (!request.fileInput)
        return;
    const input = request.fileInput.path
        ? await dependencies.readInputFile(request.fileInput.path, request.fileInput.maxBytes)
        : await dependencies.readStandardInput(request.fileInput.maxBytes);
    const tickets = parseTicketImport(input, request.fileInput.format, request.fileInput.maxBytes, request.fileInput.maxItems);
    request.body = { ...request.body, [request.fileInput.bodyName]: tickets };
}
async function materializeMultipartFiles(request, dependencies) {
    if (!request.multipartFiles?.length)
        return [];
    const parts = [];
    for (const file of request.multipartFiles) {
        const bytes = await dependencies.readInputFile(file.path, file.maxBytes);
        parts.push({
            fieldName: file.fieldName,
            filename: basename(file.path) || file.fieldName,
            bytes,
        });
    }
    return parts;
}
async function requestAllPages(client, request, limits) {
    const requestedLimit = request.query.limit;
    const limit = typeof requestedLimit === 'number' ? requestedLimit : 100;
    const combined = [];
    let combinedBytes = 0;
    let firstResponse;
    for (let page = 1; page <= limits.maxPages; page += 1) {
        const response = await client.request(request.method, request.path, {
            query: { ...request.query, page, limit },
        });
        if (page === 1)
            firstResponse = response;
        const items = extractList(response);
        if (combined.length + items.length > limits.maxItems) {
            throw new ValidationError(`Pagination exceeded the ${limits.maxItems}-item safety limit.`);
        }
        combinedBytes += Buffer.byteLength(JSON.stringify(items));
        if (combinedBytes > limits.maxBytes) {
            throw new ValidationError(`Pagination exceeded the ${limits.maxBytes}-byte safety limit.`);
        }
        for (const item of items)
            combined.push(item);
        const totalPages = extractTotalPages(response);
        if (totalPages !== undefined ? page >= totalPages : items.length < limit) {
            return combinePages(firstResponse, combined);
        }
    }
    throw new ValidationError(`Pagination exceeded the ${limits.maxPages}-page safety limit.`);
}
function extractTotalPages(value) {
    if (!value || typeof value !== 'object')
        return undefined;
    const record = value;
    const pagination = record.pagination
        ?? (record.meta && typeof record.meta === 'object'
            ? record.meta.pagination
            : undefined);
    if (!pagination || typeof pagination !== 'object')
        return undefined;
    const paginationRecord = pagination;
    const totalPages = paginationRecord.totalPages ?? paginationRecord.pages;
    return typeof totalPages === 'number' && Number.isSafeInteger(totalPages) && totalPages > 0
        ? totalPages
        : undefined;
}
function combinePages(firstResponse, data) {
    if (Array.isArray(firstResponse))
        return data;
    if (!firstResponse || typeof firstResponse !== 'object')
        return data;
    const record = firstResponse;
    const pagination = record.pagination && typeof record.pagination === 'object'
        ? record.pagination
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
async function runConfigure(argv, dependencies) {
    const path = configPathFor(dependencies.homeDirectory, dependencies.platform);
    if (argv[0] === 'show') {
        if (argv.length !== 1)
            throw new ValidationError('Usage: kooyahq configure show');
        const credentials = resolveCredentialsFromEnv(dependencies.environment) ?? await readConfig(path);
        if (!credentials)
            throw new ConfigError('KooyaHQ is not configured. Run `kooyahq configure`.');
        dependencies.output.stdout(JSON.stringify({
            baseUrl: credentials.baseUrl,
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: '[REDACTED]',
        }, null, 2));
        return 0;
    }
    if (argv[0] === 'clear') {
        if (argv.length !== 1)
            throw new ValidationError('Usage: kooyahq configure clear');
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
    const candidate = {
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
async function resolveCredentials(dependencies) {
    const fromEnvironment = resolveCredentialsFromEnv(dependencies.environment);
    if (fromEnvironment)
        return fromEnvironment;
    const path = configPathFor(dependencies.homeDirectory, dependencies.platform);
    const stored = await readConfig(path);
    if (!stored)
        throw new ConfigError('KooyaHQ is not configured. Run `kooyahq configure`.');
    return stored;
}
function createClient(credentials, dependencies) {
    return new ApiClient({
        ...credentials,
        version: dependencies.version,
        ...(dependencies.clientName ? { clientName: dependencies.clientName } : {}),
        platform: dependencies.platform,
        nodeVersion: process.versions.node,
        ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    });
}
async function resolveTimerIfNeeded(request, client) {
    if (!request.timerEligibility || !request.positionalValues)
        return;
    const { positional, status } = request.timerEligibility;
    if (request.positionalValues[positional])
        return;
    const response = await client.request('GET', '/time/timers', { query: { status } });
    const timers = extractList(response);
    if (timers.length !== 1) {
        throw new ValidationError(`Found ${timers.length} eligible ${status} timers. Supply an explicit timer id.`);
    }
    const timer = timers[0];
    const timerId = timer && typeof timer === 'object' ? timer.id : undefined;
    if (typeof timerId !== 'string' || !timerId) {
        throw new ValidationError('The eligible timer response did not contain a usable id.');
    }
    request.path = request.path.replace(`:${request.timerEligibility.pathParam ?? positional}`, encodeURIComponent(timerId));
}
function extractList(value) {
    if (Array.isArray(value))
        return value;
    if (value && typeof value === 'object' && Array.isArray(value.data)) {
        return value.data;
    }
    return [];
}
//# sourceMappingURL=run.js.map