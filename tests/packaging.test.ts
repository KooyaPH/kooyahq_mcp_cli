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
  packages?: Record<string, { version?: string; bin?: Record<string, string> }>;
};

const readme = readFileSync('README.md', 'utf8');
const installationGuide = readFileSync('docs/installation.md', 'utf8');
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const gitInstallSmoke = existsSync('scripts/smoke-git-install.mjs')
  ? readFileSync('scripts/smoke-git-install.mjs', 'utf8')
  : '';

test('GitHub installs use committed dist files without compiling TypeScript', () => {
  assert.equal(packageJson.version, '0.1.0');
  assert.equal(packageLock.version, '0.1.0');
  assert.equal(packageLock.packages?.['']?.version, '0.1.0');
  assert.equal(packageJson.bin?.kooyahq, 'dist/bin/kooyahq.js');
  assert.equal(packageJson.bin?.['kooyahq-mcp'], 'dist/bin/kooyahq-mcp.js');
  assert.equal(packageLock.packages?.['']?.bin?.['kooyahq-mcp'], 'dist/bin/kooyahq-mcp.js');
  assert.ok(packageJson.files?.includes('dist'));
  assert.ok(packageJson.files?.includes('docs'));
  assert.ok(packageJson.files?.includes('skills'));
  assert.equal(packageJson.scripts?.prepare, undefined);
  assert.equal(packageJson.scripts?.prepack, undefined);
  assert.ok(existsSync('dist/bin/kooyahq.js'));
  assert.ok(existsSync('dist/bin/kooyahq-mcp.js'));
  assert.ok(existsSync('scripts/prepare-git-install.mjs'));
  const prepare = readFileSync('scripts/prepare-git-install.mjs', 'utf8');
  for (const module of [
    'antigravity', 'claude', 'codex', 'cursor', 'gemini', 'hermes', 'index',
    'json-config', 'local-client', 'manual', 'openclaw', 'process', 'skill', 'types',
  ]) {
    assert.match(prepare, new RegExp(`dist/mcp/setup/${module}\\.js`));
  }
});

test('package includes focused MCP manuals and the KooyaHQ Codex skill', () => {
  for (const path of [
    'docs/installation.md',
    'docs/codex-mcp.md',
    'docs/scenarios.md',
    'skills/kooyahq-cli/SKILL.md',
    'skills/kooyahq-cli/VERSION',
  ]) {
    assert.ok(existsSync(path), `${path} must be packaged`);
  }

  const skill = readFileSync('skills/kooyahq-cli/SKILL.md', 'utf8');
  assert.equal(
    readFileSync('skills/kooyahq-cli/VERSION', 'utf8').trim(),
    packageJson.version,
  );
  assert.match(skill, /discover/i);
  assert.match(skill, /exact selector/i);
  assert.match(skill, /dry.?run/i);
  assert.match(skill, /confirm:\s*true/i);
  assert.match(skill, /verify.*clean.?up/is);
  assert.match(skill, /project display name/i);
  assert.match(skill, /Auth:\s*Unsupported/i);
  assert.match(skill, /Tools:\s*none/i);
});

test('README documents deterministic Codex setup and startup recovery', () => {
  assert.match(readme, /kooyahq mcp install --client codex/);
  assert.match(readme, /kooyahq mcp doctor --client codex --online/);
  assert.doesNotMatch(readme, /"command": "kooyahq-mcp"/);
  assert.match(readme, /No such file or directory/);
  assert.match(readme, /Tools:\s*none/i);
  assert.match(readme, /dangling|stale.*shim/i);
  assert.match(readme, /restart Codex.*new thread/i);
  assert.match(readme, /CODEX_HOME.*skills[/\\]kooyahq-cli/is);
  assert.match(readme, /remove.*kooyahq-cli skill/is);
});

test('README documents global GitHub install and configuration steps', () => {
  assert.match(readme, /npm install -g --install-links=true --ignore-scripts git\+https:\/\/github\.com\/KooyaPH\/kooyahq_mcp_cli\.git#v0\.1\.0/);
  assert.match(readme, /npm uninstall -g kooyahq-cli/);
  assert.match(readme, /hash -r/);
  assert.match(readme, /tsc: not found/);
  assert.match(readme, /kooyahq auth whoami/);
  assert.match(readme, /kooyahq-mcp/);
  assert.match(readme, /stdio MCP/i);
  assert.match(readme, /kooyahq_discover/);
  assert.match(readme, /kooyahq_call/);
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
  assert.match(readme, /24-character lowercase hexadecimal ObjectId/);
  assert.match(readme, /tickets import apply.*--operation-id 123e4567-e89b-42d3-a456-426614174000/);
  assert.match(readme, /canonical rich-text.*\{"type":"html","content":"<p>Ready to ship<\/p>"\}/i);
  assert.match(readme, /cost analytics.*system:fullAccess/i);
  assert.match(readme, /stored profile status/i);
  assert.match(readme, /subtask.*exactly one.*--parent-ticket-id\|--parent-ticket-key/i);
  assert.match(readme, /users templates list --output json/);
  assert.match(readme, /--page.*--all.*cannot be combined/);
  assert.match(readme, /--description-json.*--acceptance-criteria-json/);
  assert.doesNotMatch(readme, /\buser_123\b/);
  assert.doesNotMatch(readme, /global_prefix|globalPrefix|packagePath|binPath/);
});

test('installation guides cover CLI and Codex MCP setup on Linux, macOS, and Windows', () => {
  for (const guide of [readme, installationGuide]) {
    assert.match(guide, /## Linux/);
    assert.match(guide, /## macOS/);
    assert.match(guide, /## Windows/);
    assert.match(guide, /## Update/);
    assert.match(guide, /npm install -g --install-links=true --ignore-scripts git\+https:\/\/github\.com\/KooyaPH\/kooyahq_mcp_cli\.git#v0\.1\.0/);
    assert.match(guide, /kooyahq configure/);
    assert.match(guide, /kooyahq auth whoami --output json/);
    assert.match(guide, /kooyahq mcp install --client codex/);
    assert.match(guide, /kooyahq mcp doctor --client codex --online/);
    assert.match(guide, /restart Codex.*new thread/i);
  }
});

test('AI client tutorials distinguish supported local setup from remote-only products', () => {
  const clientGuide = readFileSync('docs/ai-clients/index.md', 'utf8');
  assert.match(readme, /## AI client tutorials/);
  assert.match(readme, /kooyahq mcp install --client cursor/);
  assert.match(readme, /ChatGPT.*remote gateway required/is);
  assert.match(readme, /Replit.*remote gateway required/is);
  for (const client of ['Cursor', 'Claude Code', 'Gemini CLI', 'Google Antigravity', 'OpenClaw', 'Hermes Agent']) {
    assert.match(clientGuide, new RegExp(`## ${client}`));
  }
  assert.match(clientGuide, /cursor-agent mcp list/);
  assert.match(clientGuide, /kooyahq mcp install --client claude/);
  assert.match(clientGuide, /mcpServers/);
  assert.match(clientGuide, /projects list/);
  assert.match(clientGuide, /confirm.*dryRun/is);
  assert.match(clientGuide, /ChatGPT.*remote gateway required/is);
  assert.match(clientGuide, /Replit.*remote gateway required/is);
});

test('each local MCP client tutorial distinguishes verified installation from manual registration', () => {
  const automaticClients = [
    ['cursor', 'Cursor'],
    ['claude', 'Claude Code'],
    ['gemini', 'Gemini CLI'],
    ['antigravity', 'Google Antigravity'],
  ] as const;
  for (const [slug, title] of automaticClients) {
    const guide = readFileSync(`docs/ai-clients/${slug}.md`, 'utf8');
    assert.match(guide, new RegExp(`^# KooyaHQ MCP for ${title}`, 'm'));
    assert.match(guide, /## Install/);
    assert.match(guide, /## Verify/);
    assert.match(guide, /## Use safely/);
    assert.match(guide, /## Troubleshooting and recovery/);
    assert.match(guide, new RegExp(`kooyahq mcp install --client ${slug}`));
  }
  for (const [slug, title] of [
    ['openclaw', 'OpenClaw'],
    ['hermes', 'Hermes Agent'],
  ] as const) {
    const guide = readFileSync(`docs/ai-clients/${slug}.md`, 'utf8');
    assert.match(guide, new RegExp(`^# KooyaHQ MCP for ${title}`, 'm'));
    assert.match(guide, /## Install/);
    assert.match(guide, /## Verify/);
    assert.match(guide, /## Use safely/);
    assert.match(guide, /## Troubleshooting and recovery/);
    assert.match(guide, new RegExp(`kooyahq mcp manual --client ${slug}`));
    assert.match(guide, /registration.*manual/i);
    assert.doesNotMatch(guide, new RegExp(`kooyahq mcp install --client ${slug}`));
  }
  const webGuide = readFileSync('docs/ai-clients/web-and-remote.md', 'utf8');
  assert.match(webGuide, /^# Hosted and web AI clients/m);
  assert.match(webGuide, /remote gateway required/i);
  assert.match(webGuide, /no.*chatgpt.*installer/i);
});

test('README defines timer projects as display names rather than identifiers', () => {
  assert.match(readme, /timer project options require project display names/i);
  assert.match(readme, /project IDs are rejected by the server/i);
  assert.match(readme, /kooyahq time timers start --project "Project Alpha" --task "Release review"/);
  assert.doesNotMatch(readme, /time timers start --project project_\d+/i);
});

test('README documents permission-gated events and steers chat live signals to events', () => {
  assert.match(readme, /notifications, events, announcements/);
  assert.match(readme, /### Events/);
  assert.match(readme, /events cursor/);
  assert.match(readme, /events poll --since CURSOR/);
  assert.match(readme, /events watch/);
  assert.match(readme, /API returns 403/);
  assert.match(readme, /--channels notifications,chat,tickets/);
  assert.match(readme, /no dedicated `chat watch`/i);
  assert.match(readme, /live chat, ticket, and notification signals.*events watch/is);
  assert.doesNotMatch(readme, /sockets, SSE, and `chat watch` are out of scope/);
});

test('CI verifies committed dist and smoke-tests Linux, macOS, and Windows', () => {
  assert.match(workflow, /node scripts\/verify-dist\.mjs/);
  assert.ok(existsSync('scripts/verify-dist.mjs'));
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /KOOYAHQ_CLI_ENABLE_HOSTED_SMOKE/);
  assert.match(workflow, /needs\.cross-platform-smoke\.result[\s\S]*skipped/);
  assert.match(workflow, /kooyahq\.js --skill/);
  assert.match(workflow, /kooyahq-mcp\.js/);
  assert.match(workflow, /node scripts\/smoke-mcp\.mjs/);
  assert.match(workflow, /node scripts\/smoke-git-install\.mjs/);
  assert.equal((workflow.match(/node scripts\/smoke-git-install\.mjs/g) ?? []).length, 2);
  assert.match(gitInstallSmoke, /--global/);
  assert.match(gitInstallSmoke, /--install-links=true/);
  assert.match(gitInstallSmoke, /--ignore-scripts/);
  assert.match(gitInstallSmoke, /uninstall/);
  assert.match(gitInstallSmoke, /git\+file:/);
});
