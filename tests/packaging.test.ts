import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version?: string;
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
};
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  version?: string;
  packages?: Record<string, { version?: string }>;
};

const readme = readFileSync('README.md', 'utf8');
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const gitInstallSmoke = existsSync('scripts/smoke-git-install.mjs')
  ? readFileSync('scripts/smoke-git-install.mjs', 'utf8')
  : '';

test('GitHub installs use committed dist files without compiling TypeScript', () => {
  assert.equal(packageJson.version, '0.2.0');
  assert.equal(packageLock.version, '0.2.0');
  assert.equal(packageLock.packages?.['']?.version, '0.2.0');
  assert.equal(packageJson.bin?.kooyahq, 'dist/bin/kooyahq.js');
  assert.ok(packageJson.files?.includes('dist'));
  assert.equal(packageJson.scripts?.prepare, 'node scripts/prepare-git-install.mjs');
  assert.doesNotMatch(packageJson.scripts?.prepare ?? '', /tsc|npm run build/);
  assert.ok(existsSync('dist/bin/kooyahq.js'));
  assert.ok(existsSync('scripts/prepare-git-install.mjs'));
});

test('README documents global GitHub install and configuration steps', () => {
  assert.match(readme, /npm install -g --install-links=true git\+ssh:\/\/git@github\.com\/KooyaPH\/kooyahq_cli\.git#main/);
  assert.match(readme, /npm uninstall -g kooyahq-cli/);
  assert.match(readme, /hash -r/);
  assert.match(readme, /tsc: not found/);
  assert.match(readme, /kooyahq auth whoami/);
  assert.match(readme, /kooyahq --skill tickets create/);
  assert.match(readme, /Windows/);
  assert.match(readme, /macOS/);
  assert.match(readme, /100,000 items/);
  assert.match(readme, /50 MiB/);
  assert.match(readme, /--clear-whatsapp-phone/);
  assert.match(readme, /--clear-permissions/);
  assert.match(readme, /acceptanceCriteriaJson/);
  assert.match(readme, /--direction blocked-by\|blocking\|all/);
  assert.match(readme, /--user-command/);
  assert.match(readme, /24-character hexadecimal ObjectId/);
  assert.match(readme, /subtask.*exactly one.*--parent-ticket-id\|--parent-ticket-key/i);
  assert.match(readme, /users templates list --output json/);
  assert.match(readme, /--page.*--all.*cannot be combined/);
  assert.match(readme, /--description-json.*--acceptance-criteria-json/);
  assert.doesNotMatch(readme, /global_prefix|globalPrefix|packagePath|binPath/);
});

test('CI verifies committed dist and smoke-tests Linux, macOS, and Windows', () => {
  assert.match(workflow, /git diff --exit-code -- dist/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /kooyahq\.js --skill/);
  assert.match(workflow, /node scripts\/smoke-git-install\.mjs/);
  assert.match(gitInstallSmoke, /--global/);
  assert.match(gitInstallSmoke, /--install-links=true/);
  assert.match(gitInstallSmoke, /git\+file:/);
});
