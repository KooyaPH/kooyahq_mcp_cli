import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
};

const readme = readFileSync('README.md', 'utf8');

test('GitHub installs use committed dist files without compiling TypeScript', () => {
  assert.equal(packageJson.bin?.kooyahq, 'dist/bin/kooyahq.js');
  assert.ok(packageJson.files?.includes('dist'));
  assert.equal(packageJson.scripts?.prepare, 'node scripts/prepare-git-install.mjs');
  assert.doesNotMatch(packageJson.scripts?.prepare ?? '', /tsc|npm run build/);
  assert.ok(existsSync('dist/bin/kooyahq.js'));
  assert.ok(existsSync('scripts/prepare-git-install.mjs'));
});

test('README documents global GitHub install cleanup and configuration steps', () => {
  assert.match(readme, /npm install -g --install-links=true git\+ssh:\/\/git@github\.com\/KooyaPH\/kooyahq_cli\.git#main/);
  assert.match(readme, /npm uninstall -g kooyahq-cli/);
  assert.match(readme, /unlink "\$bin_path"/);
  assert.match(readme, /unlink "\$package_path"/);
  assert.match(readme, /hash -r/);
  assert.match(readme, /ENOTEMPTY/);
  assert.match(readme, /ENOTDIR/);
  assert.match(readme, /tsc: not found/);
  assert.match(readme, /kooyahq auth whoami/);
});
