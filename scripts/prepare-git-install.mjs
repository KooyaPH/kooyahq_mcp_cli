import { accessSync, constants, readFileSync } from 'node:fs';

const requiredFiles = [
  'dist/bin/kooyahq.js',
  'dist/runtime/run.js',
  'dist/http/client.js',
  'dist/commands/catalog.js',
  'dist/config/store.js',
];

for (const file of requiredFiles) {
  accessSync(file, constants.R_OK);
}

const bin = readFileSync('dist/bin/kooyahq.js', 'utf8');

if (!bin.startsWith('#!/usr/bin/env node')) {
  throw new Error('dist/bin/kooyahq.js must start with the Node.js shebang');
}
