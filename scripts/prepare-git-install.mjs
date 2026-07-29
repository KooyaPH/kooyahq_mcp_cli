import { accessSync, constants, readFileSync } from 'node:fs';

const requiredFiles = [
  'dist/bin/kooyahq.js',
  'dist/bin/kooyahq-mcp.js',
  'dist/runtime/run.js',
  'dist/http/client.js',
  'dist/commands/catalog.js',
  'dist/config/store.js',
  'dist/mcp/setup/codex.js',
  'dist/mcp/setup/index.js',
  'dist/mcp/setup/process.js',
  'dist/mcp/setup/skill.js',
  'dist/mcp/setup/types.js',
  'docs/installation.md',
  'docs/codex-mcp.md',
  'docs/scenarios.md',
  'skills/kooyahq-cli/SKILL.md',
  'skills/kooyahq-cli/VERSION',
];

for (const file of requiredFiles) {
  accessSync(file, constants.R_OK);
}

const bin = readFileSync('dist/bin/kooyahq.js', 'utf8');

if (!bin.startsWith('#!/usr/bin/env node')) {
  throw new Error('dist/bin/kooyahq.js must start with the Node.js shebang');
}
