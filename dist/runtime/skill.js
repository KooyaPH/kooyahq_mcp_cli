import { commandCatalog } from '../commands/catalog.js';
import { commandDocumentation, commandSummary, optionConstraints, optionValueLabel, workflowFor, } from '../commands/documentation.js';
import { ValidationError } from '../core/errors.js';
export function skillOutput(argv) {
    const { scope, format } = parseSkillArguments(argv);
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
function catalogSkillMarkdown(scope, commands) {
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

## Discovery

Run \`kooyahq --skill <command>\` for exact parameters, enums, relationships, examples, and safety behavior. Add \`--output json\` for machine-readable discovery.

## Security

Every network request requires a configured KooyaHQ access key. The backend authorizes the acting key owner against resource membership and permissions; the CLI cannot widen access.
`;
}
function catalogSkillDocument(scope, commands) {
    const domain = scope[0] ?? 'root';
    return {
        schemaVersion: 1,
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
    };
}
function commandSkillMarkdown(command) {
    const documentation = commandDocumentation(command);
    const positionals = (command.positionals ?? [])
        .map((positional) => positional.optional ? `[${positional.name}]` : `<${positional.name}>`)
        .join(' ');
    const usage = ['kooyahq', command.name, positionals, '[options]'].filter(Boolean).join(' ');
    const options = Object.entries({ ...command.pathParams, ...command.query, ...command.body })
        .map(([flag, definition]) => skillOption(flag, definition, command.requiredOptions?.includes(flag) ?? false, command.exactlyOne?.some((group) => group.includes(flag)) ?? false));
    options.push('- `--output <table|json|raw>`: Select tabular, structured, or unmodified export output.');
    options.push('- `--dry-run`: Validate and print the request without authentication or network traffic.');
    if (command.query?.page && command.query.limit) {
        options.push('- `--all`: Fetch every page sequentially and return one combined result.');
    }
    if (command.confirmation)
        options.push('- `--yes`: Skip the destructive-action confirmation.');
    if (command.fileInput) {
        options.push('- `--file <path>` or `--stdin` (exactly one): Read bounded import input.');
        options.push('- `--format <json|csv>`: Override file-extension format detection.');
    }
    const relationships = [
        ...(command.exactlyOne ?? []).map((group) => `- Exactly one of: ${group.map(flagName).join(', ')}.`),
        ...(command.atMostOne ?? []).map((group) => `- At most one of: ${group.map(flagName).join(', ')}.`),
        ...(command.conditionalRequirements ?? []).map((rule) => `- \`--${rule.option}\` requires \`--${rule.requires} ${rule.value}\`.`),
        ...(command.pairedOptions ?? []).map((group) => `- Supply together or omit together: ${group.map(flagName).join(', ')}.`),
    ];
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

## Safety

Local validation runs before authentication or network traffic. Mutations are never retried automatically, and destructive commands require confirmation unless \`--yes\` is explicit. Responses and credentials are not written to CLI audit records.
`;
}
function commandSkillDocument(command) {
    const documentation = commandDocumentation(command);
    const parameters = [
        ...parameterDocuments(command, command.pathParams ?? {}, 'path'),
        ...parameterDocuments(command, command.query ?? {}, 'query'),
        ...parameterDocuments(command, command.body ?? {}, 'body'),
    ];
    if (command.fileInput) {
        parameters.push({ name: 'file', location: 'input', type: 'string', required: false }, { name: 'stdin', location: 'input', type: 'switch', required: false }, { name: 'format', location: 'input', type: 'string', required: false, choices: ['json', 'csv'] });
    }
    return {
        schemaVersion: 1,
        command: command.name,
        summary: documentation.summary,
        workflow: documentation.workflow,
        examples: documentation.examples,
        method: command.method,
        paths: command.pathVariants?.map((variant) => variant.path) ?? [command.path],
        authentication: authenticationDocument(),
        parameters,
        exactlyOne: command.exactlyOne ?? [],
        atMostOne: command.atMostOne ?? [],
        conditionalRequirements: command.conditionalRequirements ?? [],
        pairedOptions: command.pairedOptions ?? [],
        confirmationRequired: Boolean(command.confirmation),
        supportsDryRun: true,
        supportsAllPages: Boolean(command.query?.page && command.query.limit),
        mutationRetries: false,
    };
}
function parameterDocuments(command, definitions, location) {
    return Object.entries(definitions).map(([name, definition]) => ({
        name,
        location,
        type: definition.type ?? 'string',
        required: Boolean(command.requiredOptions?.includes(name)
            || command.exactlyOne?.some((group) => group.includes(name))),
        requiredDirectly: Boolean(command.requiredOptions?.includes(name)),
        requiredByExactlyOneGroup: Boolean(command.exactlyOne?.some((group) => group.includes(name))),
        ...(definition.choices ? { choices: definition.choices } : {}),
        ...(definition.format ? { format: definition.format } : {}),
        ...(optionConstraints(definition).length > 0
            ? { constraints: optionConstraints(definition) }
            : {}),
    }));
}
function authenticationDocument() {
    return {
        required: true,
        scheme: 'KooyaKey',
        authorization: 'Server permissions and resource membership are enforced for the acting user.',
    };
}
function parseSkillArguments(argv) {
    const scope = [];
    let format = 'markdown';
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--output') {
            const value = argv[index + 1];
            if (value !== 'json' && value !== 'markdown') {
                throw new ValidationError('--skill --output must be markdown or json.');
            }
            format = value;
            index += 1;
            continue;
        }
        if (token.startsWith('--output=')) {
            const value = token.slice('--output='.length);
            if (value !== 'json' && value !== 'markdown') {
                throw new ValidationError('--skill --output must be markdown or json.');
            }
            format = value;
            continue;
        }
        if (token.startsWith('--'))
            throw new ValidationError(`Unknown --skill option ${token}.`);
        scope.push(token);
    }
    return { scope, format };
}
function skillOption(flag, definition, required, oneOf) {
    const value = optionValueLabel(definition);
    const requirement = required ? 'required' : oneOf ? 'required group' : 'optional';
    const constraints = optionConstraints(definition);
    const details = [requirement, ...constraints].join('; ');
    return `- \`--${flag}${value ? ` ${value}` : ''}\`: ${details}.`;
}
function flagName(value) {
    return `\`--${value}\``;
}
//# sourceMappingURL=skill.js.map