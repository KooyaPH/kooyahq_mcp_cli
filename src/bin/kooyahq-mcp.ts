#!/usr/bin/env node
import { createRequire } from 'node:module';

import { terminalPrompt } from '../input/terminal.js';
import { runMcpServer } from '../mcp/server.js';
import { defaultDependencies } from '../runtime/run.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version: string };
const argv = process.argv.slice(2);

if (argv[0] === '--version' || argv[0] === '-v') {
  process.stdout.write(`${packageMetadata.version}\n`);
} else if (argv[0] === '--help' || argv[0] === '-h') {
  process.stdout.write(`kooyahq-mcp ${packageMetadata.version}

Local stdio MCP server for KooyaHQ.

Usage:
  kooyahq-mcp

Tools:
  kooyahq_status    Check configured KooyaHQ credentials and acting user
  kooyahq_discover  Discover commands, parameters, enums, and workflows
  kooyahq_call      Execute a structured KooyaHQ command

Configuration:
  Uses the same credentials as kooyahq configure or KOOYAHQ_* environment variables.
`);
} else if (argv.length > 0) {
  process.stderr.write('kooyahq-mcp does not accept command arguments. Run kooyahq-mcp --help.\n');
  process.exitCode = 2;
} else {
  runMcpServer({
    ...defaultDependencies(packageMetadata.version, terminalPrompt),
    clientName: 'kooyahq-mcp',
  });
}
