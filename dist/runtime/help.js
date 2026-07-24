import { commandCatalog } from '../commands/catalog.js';
export function helpText() {
    const commands = commandCatalog.map((command) => `  ${command.name}`).sort().join('\n');
    return `KooyaHQ internal command-line client

Usage:
  kooyahq configure
  kooyahq configure show|clear
  kooyahq <command> [arguments] [options]

Commands:
${commands}

List options:
  --page <n> --limit <n> --sort <field> --order <asc|desc>
  --output <table|json>

Run a command with only allowlisted flags. Destructive commands prompt unless --yes is supplied.`;
}
//# sourceMappingURL=help.js.map