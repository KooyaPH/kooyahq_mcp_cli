import { commandCatalog } from '../commands/catalog.js';
import {
  commandDocumentation,
  commandSummary,
  optionConstraints,
  optionDescription,
  optionValueLabel,
  workflowFor,
} from '../commands/documentation.js';
import type { CommandSpec, OptionSpec } from '../commands/types.js';
import { ValidationError } from '../core/errors.js';
import { configureCatalogEntries, configureSkillOutput } from './configure-docs.js';
import {
  TICKET_IMPORT_CSV_HEADERS,
  TICKET_IMPORT_ROW_FIELDS,
} from '../input/ticket-import.js';

const SKILL_SCHEMA_VERSION = 2;

export function skillOutput(argv: string[]): string {
  const { scope, format } = parseSkillArguments(argv);
  const configuration = configureSkillOutput(scope, format);
  if (configuration) return configuration;
  const name = scope.join(' ');
  const command = commandCatalog.find((candidate) => candidate.name === name);
  if (command) {
    return format === 'json'
      ? JSON.stringify(commandSkillDocument(command), null, 2)
      : commandSkillMarkdown(command);
  }

  const commands = name
    ? commandCatalog.filter((candidate) => candidate.name.startsWith(`${name} `))
    : commandCatalog;
  if (commands.length === 0) {
    throw new ValidationError(`Unknown skill scope ${name}. Run \`kooyahq --help\`.`);
  }
  return format === 'json'
    ? JSON.stringify(catalogSkillDocument(scope, commands), null, 2)
    : catalogSkillMarkdown(scope, commands);
}

function catalogSkillMarkdown(scope: string[], commands: CommandSpec[]): string {
  const name = scope.join(' ') || 'all commands';
  const domain = scope[0] ?? 'root';
  const rows = [...commands]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((command) => `- \`${command.name}\`: ${commandSummary(command)}`)
    .join('\n');
  return `# KooyaHQ CLI Skill Catalog

Scope: \`${name}\`

## Workflow

${workflowFor(domain)}

## Commands

${rows}

## Local configuration

${configureCatalogEntries().map((command) => `- \`${command.name}\`: ${command.summary}`).join('\n')}

## Discovery

Run \`kooyahq --skill <command>\` for exact parameters, enums, relationships, examples, and safety behavior. Add \`--output json\` for machine-readable discovery.

## Security

Every network request requires a configured KooyaHQ access key. The backend authorizes the acting key owner against resource membership and permissions; the CLI cannot widen access.
`;
}

function catalogSkillDocument(scope: string[], commands: CommandSpec[]): Record<string, unknown> {
  const domain = scope[0] ?? 'root';
  return {
    schemaVersion: SKILL_SCHEMA_VERSION,
    scope: scope.join(' ') || 'root',
    workflow: workflowFor(domain),
    authentication: authenticationDocument(),
    commands: [...commands]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((command) => ({
        name: command.name,
        summary: commandSummary(command),
        method: command.method,
        mutates: command.method !== 'GET',
        confirmationRequired: Boolean(command.confirmation),
        supportsAllPages: Boolean(command.query?.page && command.query.limit),
      })),
    localCommands: scope.length === 0 ? configureCatalogEntries() : [],
  };
}

function commandSkillMarkdown(command: CommandSpec): string {
  const documentation = commandDocumentation(command);
  const positionals = (command.positionals ?? [])
    .map((positional) => positional.optional ? `[${positional.name}]` : `<${positional.name}>`)
    .join(' ');
  const usage = ['kooyahq', command.name, positionals, '[options]'].filter(Boolean).join(' ');
  const options = Object.entries({ ...command.pathParams, ...command.query, ...command.body })
    .map(([flag, definition]) => skillOption(
      flag,
      definition,
      command.requiredOptions?.includes(flag) ?? false,
      command.exactlyOne?.some((group) => group.includes(flag)) ?? false,
    ));
  options.push('- `--output <table|json|raw>`: Select tabular, structured, or unmodified export output.');
  options.push('- `--dry-run`: Validate and print the request without authentication or network traffic.');
  if (command.query?.page && command.query.limit) {
    options.push('- `--all`: Fetch every page sequentially and return one combined result.');
  }
  if (command.confirmation) options.push('- `--yes`: Skip the destructive-action confirmation.');
  if (command.fileInput) {
    options.push('- `--file <path>` or `--stdin` (exactly one): Read bounded import input.');
    options.push('- `--format <json|csv>`: Override file-extension format detection.');
  }

  const relationships = [
    ...(command.exactlyOne ?? []).map((group) => `- Exactly one of: ${group.map(flagName).join(', ')}.`),
    ...(command.atLeastOne ?? []).map((group) => `- At least one of: ${group.map(flagName).join(', ')}.`),
    ...(command.atMostOne ?? []).map((group) => `- At most one of: ${group.map(flagName).join(', ')}.`),
    ...(command.conditionalRequirements ?? []).map(
      (rule) => `- \`--${rule.option}\` requires \`--${rule.requires} ${rule.value}\`.`,
    ),
    ...(command.conditionalExactlyOne ?? []).map(
      (rule) => `- When \`--${rule.when.option}\` is \`${rule.when.value}\`, supply exactly one of: ${rule.options.map(flagName).join(', ')}.`,
    ),
    ...(command.pairedOptions ?? []).map(
      (group) => `- Supply together or omit together: ${group.map(flagName).join(', ')}.`,
    ),
    ...rangeDocuments(command.dateRange).map(
      (range) => `- Date range: \`--${range.startOption}\` ${range.requireDistinctDates ? 'must be before' : 'through'} \`--${range.endOption}\`, maximum ${range.maxDays} inclusive calendar dates.`,
    ),
    ...rangeDocuments(command.dateTimeRange).map(
      (range) => `- Timestamp order: \`--${range.startOption}\` must not be after \`--${range.endOption}\`.`,
    ),
  ];
  if (command.requireBody) relationships.unshift('- At least one data option is required.');

  return `# KooyaHQ CLI Skill

Command: \`${command.name}\`

## Summary

${documentation.summary}

## Workflow

${documentation.workflow}

## Authentication

Requires a configured KooyaHQ access key owned by the acting user. Server-side permissions and resource membership are always enforced.

## Usage

\`\`\`sh
${usage}
\`\`\`

## Parameters and enums

${options.join('\n')}
${relationships.length > 0 ? `\n## Parameter relationships\n\n${relationships.join('\n')}\n` : ''}
## Examples

${documentation.examples.map((example) => `\`\`\`sh\n${example}\n\`\`\``).join('\n\n')}

${command.response ? `## Response\n\n${command.response.description}${command.response.fields?.length ? ` Fields: ${command.response.fields.map((field) => `\`${field}\``).join(', ')}.` : ''}\n` : ''}

## Safety

Local validation runs before authentication or network traffic. Mutations are never retried automatically, and destructive commands require confirmation unless \`--yes\` is explicit. Responses and credentials are not written to CLI audit records.
`;
}

function commandSkillDocument(command: CommandSpec): Record<string, unknown> {
  const documentation = commandDocumentation(command);
  const parameters = [
    ...parameterDocuments(command, command.pathParams ?? {}, 'path'),
    ...parameterDocuments(command, command.query ?? {}, 'query'),
    ...parameterDocuments(command, command.body ?? {}, 'body'),
  ];
  if (command.fileInput) {
    parameters.push(
      {
        name: 'file',
        location: 'input',
        type: 'string',
        required: false,
        requiredByExactlyOneGroup: true,
        description: optionDescription('file', 'input'),
      },
      {
        name: 'stdin',
        location: 'input',
        type: 'switch',
        required: false,
        requiredByExactlyOneGroup: true,
        description: optionDescription('stdin', 'input'),
      },
      {
        name: 'format',
        location: 'input',
        type: 'string',
        required: false,
        choices: ['json', 'csv'],
        description: optionDescription('format', 'input'),
      },
    );
  }
  const exactlyOne = [
    ...(command.exactlyOne ?? []),
    ...(command.fileInput ? [['file', 'stdin']] : []),
  ];
  return {
    schemaVersion: SKILL_SCHEMA_VERSION,
    command: command.name,
    summary: documentation.summary,
    workflow: documentation.workflow,
    examples: documentation.examples,
    method: command.method,
    paths: command.pathVariants?.map((variant) => variant.path) ?? [command.path],
    authentication: authenticationDocument(),
    parameters,
    exactlyOne,
    atLeastOne: command.atLeastOne ?? [],
    atMostOne: command.atMostOne ?? [],
    conditionalRequirements: command.conditionalRequirements ?? [],
    conditionalExactlyOne: command.conditionalExactlyOne ?? [],
    pairedOptions: command.pairedOptions ?? [],
    dateRanges: rangeDocuments(command.dateRange),
    dateTimeRanges: rangeDocuments(command.dateTimeRange),
    requiresAtLeastOneBodyOption: Boolean(command.requireBody),
    confirmationRequired: Boolean(command.confirmation),
    supportsDryRun: true,
    supportsAllPages: Boolean(command.query?.page && command.query.limit),
    mutationRetries: false,
    ...(command.response ? { response: command.response } : {}),
    ...(command.fileInput ? {
      input: {
        formats: ['json', 'csv'],
        exactlyOne: ['file', 'stdin'],
        jsonShape: 'array',
        maxBytes: command.fileInput.maxBytes,
        maxItems: command.fileInput.maxItems,
        rowFields: TICKET_IMPORT_ROW_FIELDS,
        csvHeaders: TICKET_IMPORT_CSV_HEADERS,
      },
    } : {}),
  };
}

function rangeDocuments<T>(range: T | T[] | undefined): T[] {
  if (!range) return [];
  return Array.isArray(range) ? range : [range];
}

function parameterDocuments(
  command: CommandSpec,
  definitions: Record<string, OptionSpec>,
  location: 'path' | 'query' | 'body',
): Array<Record<string, unknown>> {
  return Object.entries(definitions).map(([name, definition]) => ({
    name,
    location,
    type: definition.type ?? 'string',
    description: optionDescription(name, location),
    required: Boolean(command.requiredOptions?.includes(name)),
    requiredDirectly: Boolean(command.requiredOptions?.includes(name)),
    requiredByExactlyOneGroup: Boolean(command.exactlyOne?.some((group) => group.includes(name))),
    ...(definition.choices ? { choices: definition.choices } : {}),
    ...(definition.numericChoices ? { numericChoices: definition.numericChoices } : {}),
    ...(definition.itemChoices ? { itemChoices: definition.itemChoices } : {}),
    ...(definition.format ? { format: definition.format } : {}),
    ...(definition.jsonSchema ? { jsonSchema: definition.jsonSchema } : {}),
    ...(definition.example ? { example: definition.example } : {}),
    ...(definition.pattern ? { pattern: definition.pattern } : {}),
    ...(definition.patternDescription ? { patternDescription: definition.patternDescription } : {}),
    ...(definition.itemMaxLength !== undefined ? { itemMaxLength: definition.itemMaxLength } : {}),
    ...(definition.caseInsensitiveUniqueItems
      ? { caseInsensitiveUniqueItems: true }
      : {}),
    ...(definition.jsonNumericOrder ? { jsonNumericOrder: definition.jsonNumericOrder } : {}),
    ...(optionConstraints(definition).length > 0
      ? { constraints: optionConstraints(definition) }
      : {}),
  }));
}

function authenticationDocument(): Record<string, unknown> {
  return {
    required: true,
    scheme: 'KooyaKey',
    authorization: 'Server permissions and resource membership are enforced for the acting user.',
  };
}

function parseSkillArguments(argv: string[]): {
  scope: string[];
  format: 'markdown' | 'json';
} {
  const scope: string[] = [];
  let format: 'markdown' | 'json' = 'markdown';
  let outputSupplied = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === '--output') {
      if (outputSupplied) throw new ValidationError('--skill --output must not be repeated.');
      outputSupplied = true;
      const value = argv[index + 1];
      if (value !== 'json' && value !== 'markdown') {
        throw new ValidationError('--skill --output must be markdown or json.');
      }
      format = value;
      index += 1;
      continue;
    }
    if (token.startsWith('--output=')) {
      if (outputSupplied) throw new ValidationError('--skill --output must not be repeated.');
      outputSupplied = true;
      const value = token.slice('--output='.length);
      if (value !== 'json' && value !== 'markdown') {
        throw new ValidationError('--skill --output must be markdown or json.');
      }
      format = value;
      continue;
    }
    if (token.startsWith('--')) throw new ValidationError(`Unknown --skill option ${token}.`);
    scope.push(token);
  }
  return { scope, format };
}

function skillOption(
  flag: string,
  definition: OptionSpec,
  required: boolean,
  oneOf: boolean,
): string {
  const value = optionValueLabel(definition);
  const requirement = required ? 'required' : oneOf ? 'required group' : 'optional';
  const constraints = optionConstraints(definition);
  const details = [requirement, ...constraints].join('; ');
  return `- \`--${flag}${value ? ` ${value}` : ''}\`: ${optionDescription(flag, 'body')} ${details}.`;
}

function flagName(value: string): string {
  return `\`--${value}\``;
}
