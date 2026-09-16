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
import { configureCatalogEntries, configureHelpText } from './configure-docs.js';

export function helpText(scope: string[] = []): string {
  const configuration = configureHelpText(scope);
  if (configuration) return configuration;
  if (scope[0] === 'mcp') return mcpHelpText();
  if (scope.length > 0) {
    const name = scope.join(' ');
    const command = commandCatalog.find((candidate) => candidate.name === name);
    if (command) return commandHelp(command);

    const commands = commandCatalog.filter((candidate) => candidate.name.startsWith(`${name} `));
    if (commands.length > 0) {
      return `KooyaHQ ${name} commands

Usage:
  kooyahq ${name} <command> [options]

Workflow:
  ${workflowFor(scope[0]!)}

Commands:
${commandList(commands)}

Run \`kooyahq ${name} <command> --help\` for exact parameters, enums, constraints, and examples.`;
    }
  }

  return `KooyaHQ internal command-line client

Usage:
  kooyahq configure
  kooyahq configure show|clear
  kooyahq mcp install --client <codex|cursor|claude|gemini|antigravity>
  kooyahq mcp doctor --client <codex|cursor|claude|gemini|antigravity> [--online]
  kooyahq mcp manual --client <openclaw|hermes>
  kooyahq <command> [arguments] [options]
  kooyahq --skill [group] [command] [--output markdown|json]

Commands:
${commandList(commandCatalog)}

Local configuration:
${configureCatalogEntries().map((command) => `  ${command.name.padEnd(18)}${command.summary}`).join('\n')}

Global behavior:
  --output <table|json|raw>  Select tabular, structured, or unmodified text output.
  --dry-run              Validate and print a request without credentials or network traffic.
  --all                  Fetch every page for a paginated GET command.
  --yes                  Skip confirmation only where a command documents it.
  --help                 Show offline help without reading configuration.

Authentication and authorization are enforced by the backend for every request. Mutations are never retried automatically.`;
}

function mcpHelpText(): string {
  return `KooyaHQ local MCP setup

Usage:
  kooyahq mcp install --client <codex|cursor|claude|gemini|antigravity>
  kooyahq mcp doctor --client <codex|cursor|claude|gemini|antigravity>
  kooyahq mcp doctor --client <codex|cursor|claude|gemini|antigravity> --online
  kooyahq mcp manual --client <openclaw|hermes>

Supported clients:
  codex        Codex, including the packaged kooyahq-cli skill
  cursor       Cursor on this operating system
  claude       Claude Code
  gemini       Gemini CLI
  antigravity  Google Antigravity
Manual-only clients:
  openclaw     OpenClaw (manual registration; no automated install or doctor)
  hermes       Hermes (manual registration; no automated install or doctor)

Install registers an absolute local stdio command. Codex also installs the packaged kooyahq-cli skill.
Doctor checks the package, client registration, and local MCP handshake; Codex additionally checks its skill version. Claude Code cannot expose its registration as a stable structured descriptor, so its doctor fails closed instead of treating a generic lookup as proof.
Use manual for OpenClaw or Hermes to print their client-specific local stdio registration values without modifying client configuration.
Run the command from the operating system that owns the client: a Windows Cursor desktop uses Windows paths, while WSL configures WSL-local clients.
Use --online to also validate the configured KooyaHQ profile.`;
}

function commandHelp(command: CommandSpec): string {
  const documentation = commandDocumentation(command);
  const positionals = (command.positionals ?? [])
    .map((positional) => positional.optional ? `[${positional.name}]` : `<${positional.name}>`)
    .join(' ');
  const usage = ['kooyahq', command.name, positionals, '[options]'].filter(Boolean).join(' ');
  const definitions = { ...command.pathParams, ...command.query, ...command.body };
  const options = Object.entries(definitions)
    .map(([name, definition]) => formatOption(
      name,
      definition,
      command.requiredOptions?.includes(name) ?? false,
      command.exactlyOne?.some((group) => group.includes(name)) ?? false,
    ));
  options.push('  --output <table|json|raw>  Output format; raw is intended for exports.');
  options.push('  --dry-run              Validate and print the request without authentication or network traffic.');
  if (command.query?.page && command.query.limit) {
    options.push('  --all                  Fetch every page sequentially.');
  }
  if (command.confirmation) options.push('  --yes                  Skip the documented confirmation prompt.');
  if (command.fileInput) {
    options.push('  --file <path>           Read a bounded import file (exclusive with --stdin).');
    options.push('  --stdin                 Read bounded import input from standard input (exclusive with --file).');
    options.push('  --format <json|csv>     Override file-extension format detection.');
  }
  for (const file of command.multipartFiles ?? []) {
    const required = file.required ? ' (required)' : ' (optional)';
    options.push(`  --${file.flag} <path>        Multipart file for field ${file.fieldName}${required}.`);
  }
  options.push('  --help                 Show this help without reading configuration.');

  const groups = [
    ...(command.exactlyOne ?? []).map((group) => `  Exactly one: ${group.map(flag).join(', ')}`),
    ...(command.atLeastOne ?? []).map((group) => `  At least one: ${group.map(flag).join(', ')}`),
    ...(command.atMostOne ?? []).map((group) => `  At most one: ${group.map(flag).join(', ')}`),
    ...(command.conditionalRequirements ?? []).map(
      (rule) => `  Conditional: --${rule.option} requires --${rule.requires} ${rule.value}`,
    ),
    ...(command.conditionalExactlyOne ?? []).map(
      (rule) => `  When --${rule.when.option} is ${rule.when.value}, supply exactly one of ${rule.options.map(flag).join(', ')}`,
    ),
    ...(command.pairedOptions ?? []).map(
      (group) => `  Together: ${group.map(flag).join(', ')}`,
    ),
    ...rangeDocuments(command.dateRange).map(
      (range) => `  Date range: --${range.startOption} ${range.requireDistinctDates ? 'before' : 'through'} --${range.endOption}; maximum ${range.maxDays} inclusive calendar dates`,
    ),
    ...rangeDocuments(command.dateTimeRange).map(
      (range) => `  Timestamp order: --${range.startOption} must not be after --${range.endOption}`,
    ),
  ];
  if (command.requireBody) groups.unshift('  At least one data option is required.');
  const deprecated = (command.positionals ?? [])
    .filter((positional) => positional.deprecated && positional.aliasFor)
    .map((positional) => `  <${positional.name}> is deprecated; use --${positional.aliasFor}.`);

  return `KooyaHQ command: ${command.name}

Summary:
  ${documentation.summary}

Workflow:
  ${documentation.workflow}

Usage:
  ${usage}

Options:
${options.join('\n')}
${groups.length > 0 ? `\nRelationships:\n${groups.join('\n')}\n` : ''}${deprecated.length > 0 ? `\nCompatibility:\n${deprecated.join('\n')}\n` : ''}
Examples:
${documentation.examples.map((example) => `  ${example}`).join('\n')}

${command.response ? `Response:\n  ${command.response.description}\n\n` : ''}
Security:
  The backend authorizes the acting access-key owner for every resource. This command cannot bypass board, team, or administrator permissions.`;
}

function commandList(commands: CommandSpec[]): string {
  const names = commands.map((command) => command.name);
  const width = Math.max(...names.map((name) => name.length)) + 2;
  return [...commands]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((command) => `  ${command.name.padEnd(width)}${commandSummary(command)}`)
    .join('\n');
}

function formatOption(
  name: string,
  definition: OptionSpec,
  required: boolean,
  oneOf: boolean,
): string {
  const value = optionValueLabel(definition);
  const requirement = required ? 'required' : oneOf ? 'required group' : '';
  const details = [requirement, ...optionConstraints(definition)].filter(Boolean);
  return `  --${name}${value ? ` ${value}` : ''}  ${optionDescription(name, 'body')}${details.length > 0 ? ` (${details.join('; ')})` : ''}`;
}

function flag(value: string): string {
  return `--${value}`;
}

function rangeDocuments<T>(range: T | T[] | undefined): T[] {
  if (!range) return [];
  return Array.isArray(range) ? range : [range];
}
