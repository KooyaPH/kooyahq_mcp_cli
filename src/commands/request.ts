import { ValidationError } from '../core/errors.js';
import type {
  CommandRequest,
  CommandSpec,
  OptionSpec,
  OutputFormat,
  ValueType,
} from './types.js';

interface ParsedOptions {
  values: Record<string, string>;
  yes: boolean;
  output: OutputFormat;
}

type OptionValue = string | number | boolean | string[] | unknown[] | Record<string, unknown>;

export function buildRequest(catalog: CommandSpec[], argv: string[]): CommandRequest {
  const command = findCommand(catalog, argv);
  const commandTokenCount = command.name.split(' ').length;
  const remaining = argv.slice(commandTokenCount);
  const firstOption = remaining.findIndex((token) => token.startsWith('--'));
  const positionalTokens = firstOption === -1 ? remaining : remaining.slice(0, firstOption);
  const optionTokens = firstOption === -1 ? [] : remaining.slice(firstOption);
  const positionals = bindPositionals(command, positionalTokens);
  const allowed = { ...command.query, ...command.body };
  const parsed = parseOptions(optionTokens, allowed, Boolean(command.confirmation));
  for (const required of command.requiredOptions ?? []) {
    if (parsed.values[required] === undefined) {
      throw new ValidationError(`${command.name} requires --${required}.`);
    }
  }
  const query = mapOptions(parsed.values, command.query ?? {}) as CommandRequest['query'];
  const providedBody = mapOptions(parsed.values, command.body ?? {});
  const positionalBody = Object.fromEntries(
    Object.entries(command.bodyPositionals ?? {}).flatMap(([positional, apiName]) => {
      const value = positionals[positional];
      return value === undefined ? [] : [[apiName, value]];
    }),
  );
  const body = { ...command.staticBody, ...positionalBody, ...providedBody };

  if (command.requireBody && Object.keys(providedBody).length === 0) {
    throw new ValidationError(`${command.name} requires at least one data option.`);
  }

  let path = command.path;
  for (const [name, value] of Object.entries(positionals)) {
    if (value !== undefined) path = path.replace(`:${name}`, encodeURIComponent(value));
  }
  const confirmation = command.confirmation && !parsed.yes
    ? interpolate(command.confirmation, positionals)
    : undefined;
  const request: CommandRequest = { method: command.method, path, query, output: parsed.output };
  if (Object.keys(body).length > 0) request.body = body;
  if (confirmation) request.confirmation = confirmation;
  if (command.timerEligibility) {
    request.timerEligibility = command.timerEligibility;
    request.positionalValues = positionals;
  }
  return request;
}

function findCommand(catalog: CommandSpec[], argv: string[]): CommandSpec {
  const matches = catalog.filter((command) => {
    const nameTokens = command.name.split(' ');
    return nameTokens.every((token, index) => argv[index] === token);
  }).sort((left, right) => right.name.length - left.name.length);
  if (!matches[0]) throw new ValidationError('Unknown command. Run `kooyahq --help`.');
  return matches[0];
}

function bindPositionals(
  command: CommandSpec,
  tokens: string[],
): Record<string, string | undefined> {
  const definitions = command.positionals ?? [];
  if (tokens.length > definitions.length) throw new ValidationError(`Too many arguments for ${command.name}.`);
  const values: Record<string, string | undefined> = {};
  definitions.forEach((definition, index) => {
    const value = tokens[index];
    if (!value && !definition.optional) {
      throw new ValidationError(`Missing required argument <${definition.name}> for ${command.name}.`);
    }
    values[definition.name] = value;
  });
  return values;
}

function parseOptions(
  tokens: string[],
  allowed: Record<string, OptionSpec>,
  allowYes: boolean,
): ParsedOptions {
  const values: Record<string, string> = {};
  let yes = false;
  let output: OutputFormat = 'table';
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!token.startsWith('--')) throw new ValidationError(`Unexpected argument ${token}.`);
    const [rawName, inlineValue] = token.slice(2).split('=', 2);
    if (!rawName) throw new ValidationError('Option name must not be blank.');
    if (rawName === 'yes') {
      if (!allowYes) throw new ValidationError('Unknown option --yes.');
      if (inlineValue !== undefined) throw new ValidationError('--yes does not take a value.');
      yes = true;
      continue;
    }
    const value = inlineValue ?? tokens[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new ValidationError(`Option --${rawName} requires a value.`);
    }
    if (inlineValue === undefined) index += 1;
    if (rawName === 'output') {
      if (value !== 'table' && value !== 'json') {
        throw new ValidationError('--output must be table or json.');
      }
      output = value;
      continue;
    }
    if (!allowed[rawName]) throw new ValidationError(`Unknown option --${rawName}.`);
    values[rawName] = value;
  }

  if (values.order && values.order !== 'asc' && values.order !== 'desc') {
    throw new ValidationError('--order must be asc or desc.');
  }
  return { values, yes, output };
}

function mapOptions(
  values: Record<string, string>,
  definitions: Record<string, OptionSpec>,
): Record<string, OptionValue> {
  const result: Record<string, OptionValue> = {};
  for (const [flag, definition] of Object.entries(definitions)) {
    const raw = values[flag];
    if (raw === undefined) continue;
    const converted = convertValue(raw, definition.type ?? 'string', flag);
    if (definition.choices && typeof converted === 'string' && !definition.choices.includes(converted)) {
      throw new ValidationError(`--${flag} must be ${formatChoices(definition.choices)}.`);
    }
    result[definition.apiName] = converted;
  }
  return result;
}

function convertValue(value: string, type: ValueType, flag: string): OptionValue {
  if (type === 'integer') {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new ValidationError(`--${flag} must be a positive integer.`);
    }
    return number;
  }
  if (type === 'boolean') {
    if (value !== 'true' && value !== 'false') {
      throw new ValidationError(`--${flag} must be true or false.`);
    }
    return value === 'true';
  }
  if (type === 'csv') {
    const values = value.split(',').map((item) => item.trim()).filter(Boolean);
    if (values.length === 0) throw new ValidationError(`--${flag} must not be blank.`);
    return values;
  }
  if (type === 'singleton') {
    if (!value.trim()) throw new ValidationError(`--${flag} must not be blank.`);
    return [value];
  }
  if (type === 'json-object' || type === 'json-array') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new ValidationError(`--${flag} must be a valid JSON ${type === 'json-array' ? 'array' : 'object'}.`);
    }
    const valid = type === 'json-array'
      ? Array.isArray(parsed)
      : Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
    if (!valid) {
      throw new ValidationError(`--${flag} must be a valid JSON ${type === 'json-array' ? 'array' : 'object'}.`);
    }
    return parsed as unknown[] | Record<string, unknown>;
  }
  if (!value.trim()) throw new ValidationError(`--${flag} must not be blank.`);
  return value;
}

function formatChoices(choices: string[]): string {
  if (choices.length === 2) return `${choices[0]} or ${choices[1]}`;
  return choices.join(', ');
}

function interpolate(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => values[name] ?? 'resource');
}
