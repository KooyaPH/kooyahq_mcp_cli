import { commandCatalog } from '../commands/catalog.js';
import type { CommandSpec, OptionSpec } from '../commands/types.js';
import { ValidationError } from '../core/errors.js';
import { runCli, type RuntimeDependencies } from '../runtime/run.js';
import { skillOutput } from '../runtime/skill.js';

export type McpBridgeDependencies = RuntimeDependencies;

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

interface McpCallInput {
  command: string;
  args?: Record<string, unknown>;
  confirm?: boolean;
  dryRun?: boolean;
  all?: boolean;
}

const SPECIAL_MCP_ARGS = new Set(['input']);

export function mcpToolDefinitions(): McpToolDefinition[] {
  return [
    {
      name: 'kooyahq_status',
      description: 'Check the configured KooyaHQ access key and return the acting user profile.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: 'kooyahq_discover',
      description: 'Return machine-readable KooyaHQ command, parameter, enum, and workflow metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            description: 'Optional command or command group, for example "tickets create" or "boards".',
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'kooyahq_call',
      description: 'Execute one KooyaHQ CLI command using structured arguments and existing CLI validation.',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Exact command name from kooyahq_discover, for example "tickets list".',
          },
          args: {
            type: 'object',
            description: 'Command arguments keyed by CLI flag name without leading dashes. File imports use input.',
            additionalProperties: true,
          },
          confirm: {
            type: 'boolean',
            description: 'Required as true for every non-GET command before network traffic is allowed.',
          },
          dryRun: {
            type: 'boolean',
            description: 'Validate and return the request shape without credentials or network traffic.',
          },
          all: {
            type: 'boolean',
            description: 'Fetch every page for paginated list commands, subject to CLI safety limits.',
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
  ];
}

export async function callMcpTool(
  name: string,
  input: unknown,
  dependencies: McpBridgeDependencies,
): Promise<unknown> {
  if (name === 'kooyahq_discover') return discover(input);
  if (name === 'kooyahq_status') return runStructured(['auth', 'whoami'], dependencies);
  if (name === 'kooyahq_call') return callCommand(input, dependencies);
  throw new ValidationError(`Unknown KooyaHQ MCP tool ${name}.`);
}

function discover(input: unknown): unknown {
  const record = optionalRecord(input, 'kooyahq_discover input');
  const scopeValue = record.scope;
  if (scopeValue !== undefined && typeof scopeValue !== 'string') {
    throw new ValidationError('kooyahq_discover scope must be a string.');
  }
  const scope = scopeValue?.trim()
    ? scopeValue.trim().split(/\s+/)
    : [];
  return JSON.parse(skillOutput([...scope, '--output', 'json'])) as unknown;
}

async function callCommand(
  input: unknown,
  dependencies: McpBridgeDependencies,
): Promise<unknown> {
  const call = parseCallInput(input);
  const command = commandCatalog.find((candidate) => candidate.name === call.command);
  if (!command) throw new ValidationError(`Unknown command ${call.command}. Run kooyahq_discover first.`);
  if (command.method !== 'GET' && call.confirm !== true) {
    throw new ValidationError('MCP mutations require confirm: true before network traffic is allowed.');
  }
  const argv = buildMcpArgv(command, call);
  return runStructured(argv, dependencies, stdinBytesFor(command, call.args ?? {}));
}

function parseCallInput(input: unknown): McpCallInput {
  const record = optionalRecord(input, 'kooyahq_call input');
  if (typeof record.command !== 'string' || !record.command.trim()) {
    throw new ValidationError('kooyahq_call command must be a non-blank string.');
  }
  const args = record.args === undefined ? undefined : optionalRecord(record.args, 'kooyahq_call args');
  const confirm = record.confirm;
  const dryRun = record.dryRun;
  const all = record.all;
  if (confirm !== undefined && typeof confirm !== 'boolean') {
    throw new ValidationError('kooyahq_call confirm must be a boolean.');
  }
  if (dryRun !== undefined && typeof dryRun !== 'boolean') {
    throw new ValidationError('kooyahq_call dryRun must be a boolean.');
  }
  if (all !== undefined && typeof all !== 'boolean') {
    throw new ValidationError('kooyahq_call all must be a boolean.');
  }
  return {
    command: record.command.trim(),
    ...(args ? { args } : {}),
    ...(confirm === undefined ? {} : { confirm }),
    ...(dryRun === undefined ? {} : { dryRun }),
    ...(all === undefined ? {} : { all }),
  };
}

function buildMcpArgv(command: CommandSpec, input: McpCallInput): string[] {
  const args = input.args ?? {};
  validateMcpArguments(command, args);
  const argv = [...command.name.split(' ')];
  for (const positional of command.positionals ?? []) {
    const value = args[positional.name];
    if (value === undefined) continue;
    argv.push(stringifyScalar(value, positional.name));
  }
  for (const [flag, definition] of optionEntries(command)) {
    const value = args[flag];
    if (value === undefined) continue;
    appendOption(argv, flag, definition, value);
  }
  if (command.fileInput) {
    argv.push('--stdin', '--format', 'json');
  }
  if (input.confirm === true && command.confirmation) argv.push('--yes');
  if (input.dryRun) argv.push('--dry-run');
  if (input.all) argv.push('--all');
  return argv;
}

function validateMcpArguments(command: CommandSpec, args: Record<string, unknown>): void {
  const allowed = new Set([
    ...Object.keys(command.pathParams ?? {}),
    ...Object.keys(command.query ?? {}),
    ...Object.keys(command.body ?? {}),
    ...(command.positionals ?? []).map((positional) => positional.name),
    ...(command.fileInput ? ['input'] : []),
  ]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new ValidationError(`Unknown MCP argument ${key} for ${command.name}.`);
  }
  if (command.fileInput && args.input === undefined) {
    throw new ValidationError(`${command.name} requires args.input for MCP import input.`);
  }
}

function optionEntries(command: CommandSpec): Array<[string, OptionSpec]> {
  return [
    ...Object.entries(command.pathParams ?? {}),
    ...Object.entries(command.query ?? {}),
    ...Object.entries(command.body ?? {}),
  ].filter(([flag]) => !SPECIAL_MCP_ARGS.has(flag));
}

function appendOption(
  argv: string[],
  flag: string,
  definition: OptionSpec,
  value: unknown,
): void {
  if (definition.type === 'switch') {
    if (value === true) argv.push(`--${flag}`);
    else if (value !== false) throw new ValidationError(`MCP argument ${flag} must be a boolean.`);
    return;
  }
  argv.push(`--${flag}`, stringifyOptionValue(value, definition, flag));
}

function stringifyOptionValue(
  value: unknown,
  definition: OptionSpec,
  flag: string,
): string {
  if (definition.type === 'json-object' || definition.type === 'json-array') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new ValidationError(`MCP argument ${flag} must be JSON-serializable.`);
    return serialized;
  }
  if (definition.type === 'csv') {
    if (Array.isArray(value)) return value.map((item) => stringifyScalar(item, flag)).join(',');
    return stringifyScalar(value, flag);
  }
  if (definition.type === 'singleton') {
    if (Array.isArray(value)) {
      if (value.length !== 1) throw new ValidationError(`MCP argument ${flag} accepts one value.`);
      return stringifyScalar(value[0], flag);
    }
    return stringifyScalar(value, flag);
  }
  return stringifyScalar(value, flag);
}

function stringifyScalar(value: unknown, name: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ValidationError(`MCP argument ${name} must be finite.`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  throw new ValidationError(`MCP argument ${name} must be a scalar value.`);
}

function stdinBytesFor(command: CommandSpec, args: Record<string, unknown>): Uint8Array | undefined {
  if (!command.fileInput) return undefined;
  const serialized = JSON.stringify(args.input);
  if (serialized === undefined) throw new ValidationError('MCP import input must be JSON-serializable.');
  const encoded = new TextEncoder().encode(serialized);
  if (encoded.byteLength > command.fileInput.maxBytes) {
    throw new ValidationError(`MCP import input exceeds the ${command.fileInput.maxBytes} byte limit.`);
  }
  return encoded;
}

async function runStructured(
  argv: string[],
  dependencies: McpBridgeDependencies,
  stdin?: Uint8Array,
): Promise<unknown> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli([...argv, '--output', 'json'], {
    ...dependencies,
    clientName: 'kooyahq-mcp',
    prompt: async () => {
      throw new ValidationError('MCP tools cannot answer interactive prompts. Pass confirm: true where required.');
    },
    readStandardInput: stdin
      ? async (maxBytes) => {
        if (stdin.byteLength > maxBytes) throw new ValidationError(`MCP stdin exceeds the ${maxBytes} byte limit.`);
        return stdin;
      }
      : dependencies.readStandardInput,
    output: {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    },
  });
  if (exitCode !== 0) {
    throw new ValidationError(stderr.join('\n') || stdout.join('\n') || `KooyaHQ command failed with exit code ${exitCode}.`);
  }
  return parseJsonOutput(stdout.join('\n'));
}

function parseJsonOutput(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function optionalRecord(input: unknown, label: string): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError(`${label} must be an object.`);
  }
  return input as Record<string, unknown>;
}
