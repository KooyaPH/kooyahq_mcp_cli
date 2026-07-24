import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
};

const readme = readFileSync('README.md', 'utf8');

test('GitHub installs use committed dist files instead of compiling during npm prepare', () => {
  assert.equal(packageJson.bin?.kooyahq, 'dist/bin/kooyahq.js');
  assert.ok(packageJson.files?.includes('dist'));
  assert.equal(packageJson.scripts?.prepare, undefined);
  assert.ok(existsSync('dist/bin/kooyahq.js'));
});

test('README documents global GitHub install cleanup and configuration steps', () => {
  assert.match(readme, /npm install -g git\+ssh:\/\/git@github\.com\/KooyaPH\/kooyahq_cli\.git#main/);
  assert.match(readme, /npm uninstall -g kooyahq-cli/);
  assert.match(readme, /ENOTDIR/);
  assert.match(readme, /tsc: not found/);
  assert.match(readme, /kooyahq auth whoami/);
});
