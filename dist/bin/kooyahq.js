#!/usr/bin/env node
import { createRequire } from 'node:module';
import { terminalPrompt } from '../input/terminal.js';
import { defaultDependencies, runCli } from '../runtime/run.js';
const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json');
const exitCode = await runCli(process.argv.slice(2), defaultDependencies(packageMetadata.version, terminalPrompt));
process.exitCode = exitCode;
//# sourceMappingURL=kooyahq.js.map