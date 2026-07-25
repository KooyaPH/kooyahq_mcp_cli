import { ValidationError } from '../core/errors.js';

const CONFIGURE_COMMANDS = [
  { name: 'configure', summary: 'Validate and store credentials using private interactive prompts.' },
  { name: 'configure show', summary: 'Show the active endpoint and access key with credentials redacted.' },
  { name: 'configure clear', summary: 'Remove the locally stored profile.' },
];

export function configureHelpText(scope: string[]): string | undefined {
  if (scope[0] !== 'configure') return undefined;
  if (scope.length === 1) {
    return `KooyaHQ local configuration

Usage:
  kooyahq configure
  kooyahq configure show
  kooyahq configure clear

Commands:
  configure        Validate and store credentials using private interactive prompts.
  configure show   Show the active endpoint and access key with credentials redacted.
  configure clear  Remove the locally stored profile.

Security:
  Configuration is validated with /whoami before it is saved. Blank credentials never trigger a request.`;
  }
  if (scope.length === 2 && scope[1] === 'show') {
    return `KooyaHQ command: configure show

Usage:
  kooyahq configure show

Behavior:
  Shows the active endpoint and access key. Stored credentials are always redacted.`;
  }
  if (scope.length === 2 && scope[1] === 'clear') {
    return `KooyaHQ command: configure clear

Usage:
  kooyahq configure clear

Behavior:
  Removes only the locally stored KooyaHQ profile. Environment-provided configuration is unchanged.`;
  }
  return undefined;
}

export function configureSkillOutput(
  scope: string[],
  format: 'markdown' | 'json',
): string | undefined {
  if (scope[0] !== 'configure') return undefined;
  const command = scope.join(' ');
  if (!CONFIGURE_COMMANDS.some((candidate) => candidate.name === command)) {
    throw new ValidationError(`Unknown skill scope ${command}. Run \`kooyahq configure --help\`.`);
  }
  if (format === 'json') {
    return JSON.stringify({
      schemaVersion: 2,
      command,
      authentication: { required: false },
      localOnly: command !== 'configure',
      networkBehavior: command === 'configure'
        ? 'Validates the candidate profile with GET /whoami before saving.'
        : 'No network request is sent.',
      subcommands: command === 'configure' ? CONFIGURE_COMMANDS : [
        CONFIGURE_COMMANDS.find((candidate) => candidate.name === command),
      ],
      safety: 'Credentials are never accepted as command-line flags or printed in discovery output.',
    }, null, 2);
  }
  const selected = command === 'configure'
    ? CONFIGURE_COMMANDS
    : CONFIGURE_COMMANDS.filter((candidate) => candidate.name === command);
  return `# KooyaHQ CLI Skill

Command: \`${command}\`

## Local configuration commands

${selected.map((candidate) => `- \`kooyahq ${candidate.name}\`: ${candidate.summary}`).join('\n')}

## Safety

Credentials are entered only through private interactive prompts, never command-line flags. The base configuration command validates with \`GET /whoami\` before saving; show and clear do not send network requests.
`;
}

export function configureCatalogEntries() {
  return CONFIGURE_COMMANDS.map((command) => ({ ...command }));
}
