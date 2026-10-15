import { stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CliError, NetworkError, ValidationError } from '../core/errors.js';
import { runCommandWithLimits } from '../mcp/setup/process.js';
import { installSkill } from '../mcp/setup/skill.js';
import type { CommandResult } from '../mcp/setup/types.js';

export const LATEST_RELEASE_URL = 'https://api.github.com/repos/KooyaPH/kooyahq_mcp_cli/releases/latest';
const INSTALL_SOURCE = 'git+https://github.com/KooyaPH/kooyahq_mcp_cli.git';
const NPM_TIMEOUT_MS = 5 * 60_000;

export interface UpdateOverrides {
  runCommand?: (command: string, args: string[]) => Promise<CommandResult>;
  packageRoot?: string;
}

export interface UpdateContext {
  version: string;
  environment: NodeJS.ProcessEnv;
  homeDirectory: string;
  platform: NodeJS.Platform;
  fetch?: typeof globalThis.fetch;
  prompt: (question: string, hidden?: boolean) => Promise<string>;
  output: { stdout: (value: string) => void; stderr: (value: string) => void };
  overrides?: UpdateOverrides;
}

export function installArguments(tag: string): string[] {
  return ['install', '-g', '--install-links=true', '--ignore-scripts', `${INSTALL_SOURCE}#${tag}`];
}

export async function runUpdate(argv: string[], context: UpdateContext): Promise<number> {
  let check = false;
  let yes = false;
  for (const token of argv) {
    if (token === '--check') check = true;
    else if (token === '--yes') yes = true;
    else throw new ValidationError('Usage: kooyahq update [--check] [--yes]');
  }

  const current = parseVersion(context.version);
  if (!current) throw new ValidationError(`Installed version ${context.version} is not a release version.`);
  const tag = await latestReleaseTag(context.fetch ?? globalThis.fetch);
  const latest = tag.startsWith('v') ? parseVersion(tag.slice(1)) : undefined;
  if (!latest) throw new CliError(`Latest release tag ${tag} is not a vX.Y.Z version.`, 1);

  if (compareVersions(latest, current) <= 0) {
    context.output.stdout(`kooyahq-cli ${context.version} is up to date (latest release ${tag}).`);
    return 0;
  }
  if (check) {
    context.output.stdout(`Update available: ${context.version} -> ${tag.slice(1)}. Run \`kooyahq update\` to install it.`);
    return 0;
  }
  if (!yes) {
    const answer = (await context.prompt(
      `Install kooyahq-cli ${tag}? This runs npm uninstall -g kooyahq-cli, then npm install -g ${INSTALL_SOURCE}#${tag}. [y/N]`,
    )).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes') {
      context.output.stdout('Cancelled.');
      return 0;
    }
  }

  const run = context.overrides?.runCommand ?? ((command, args) => runCommandWithLimits(
    command,
    args,
    context.environment,
    { timeoutMs: NPM_TIMEOUT_MS, maxOutputBytes: 1024 * 1024, killGraceMs: 250 },
    context.platform,
  ));
  const npm = context.platform === 'win32' ? 'npm.cmd' : 'npm';
  const manual = `npm install -g --install-links=true --ignore-scripts ${INSTALL_SOURCE}#${tag}`;

  const uninstall = await run(npm, ['uninstall', '-g', 'kooyahq-cli']);
  if (uninstall.status !== 0) {
    context.output.stderr(uninstall.stderr.trim());
    throw new CliError('npm uninstall -g kooyahq-cli failed; the installed version was left unchanged.', 1);
  }
  const install = await run(npm, installArguments(tag));
  if (install.status !== 0) {
    context.output.stderr(install.stderr.trim());
    throw new CliError(`npm install failed after the previous version was removed. Reinstall manually: ${manual}`, 1);
  }
  context.output.stdout(`Updated kooyahq-cli to ${tag.slice(1)}.`);

  await refreshCodexSkill(context);
  if (context.platform !== 'win32') context.output.stdout('Run `hash -r` if your shell still resolves the previous command.');
  return 0;
}

async function latestReleaseTag(fetchImpl: typeof globalThis.fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'kooyahq-cli' },
    });
  } catch {
    throw new NetworkError('Unable to reach GitHub to check for the latest release.');
  }
  if (!response.ok) {
    throw new CliError(`GitHub latest release lookup failed with HTTP ${response.status}.`, 1);
  }
  const body = await response.json() as { tag_name?: unknown };
  if (typeof body.tag_name !== 'string') {
    throw new CliError('GitHub latest release response did not include a tag.', 1);
  }
  return body.tag_name;
}

async function refreshCodexSkill(context: UpdateContext): Promise<void> {
  const configured = context.environment.CODEX_HOME;
  const codexRoot = configured && isAbsolute(configured) ? configured : join(context.homeDirectory, '.codex');
  const skillRoot = join(codexRoot, 'skills');
  try {
    await stat(join(skillRoot, 'kooyahq-cli', 'VERSION'));
  } catch {
    return;
  }
  const packageRoot = context.overrides?.packageRoot
    ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  try {
    await installSkill(packageRoot, skillRoot);
    context.output.stdout('Refreshed the kooyahq-cli Codex skill.');
  } catch {
    context.output.stderr('Warning: could not refresh the Codex skill. Run `kooyahq mcp install --client codex`.');
  }
}

function parseVersion(value: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function compareVersions(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return 0;
}
