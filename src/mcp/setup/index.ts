import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationError } from '../../core/errors.js';
import { doctorCodexIntegration, installCodexIntegration } from './codex.js';
import { codexExecutable, probeMcp, runCommand } from './process.js';
import type { DoctorReport, SetupDependencies, SetupOverrides } from './types.js';

export { doctorCodexIntegration, installCodexIntegration } from './codex.js';
export type { SetupDependencies, SetupOverrides } from './types.js';

interface SetupContext {
  homeDirectory: string;
  version: string;
  environment: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  onlineCheck: () => Promise<boolean>;
  overrides?: SetupOverrides;
}

export interface SetupCommandResult {
  exitCode: 0 | 2;
  stdout: string[];
  stderr: string[];
}

export async function runMcpSetupCommand(
  argv: string[],
  context: SetupContext,
): Promise<SetupCommandResult> {
  const parsed = parseSetupCommand(argv);
  const dependencies = setupDependencies(context);
  if (parsed.action === 'install') {
    await installCodexIntegration(dependencies);
    return {
      exitCode: 0,
      stdout: [
        'KooyaHQ MCP and the kooyahq-cli skill are installed for Codex.',
        'Restart Codex, then open a new thread so the MCP tools and skill are reloaded.',
      ],
      stderr: [],
    };
  }

  const report = await doctorCodexIntegration(dependencies, parsed.online);
  return formatDoctorReport(report);
}

function setupDependencies(context: SetupContext): SetupDependencies {
  const packageRoot = context.overrides?.packageRoot
    ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const nodeExecutable = context.overrides?.nodeExecutable ?? process.execPath;
  const configuredCodexRoot = context.environment.CODEX_HOME;
  if (configuredCodexRoot && !isAbsolute(configuredCodexRoot)) {
    throw new ValidationError('CODEX_HOME must be an absolute path.');
  }
  const codexRoot = configuredCodexRoot || join(context.homeDirectory, '.codex');
  const environment = { ...context.environment, CODEX_HOME: codexRoot };
  return {
    homeDirectory: context.homeDirectory,
    codexRoot,
    codexCommand: codexExecutable(context.platform),
    platform: context.platform,
    packageRoot,
    version: context.version,
    nodeExecutable,
    environment,
    runCommand: context.overrides?.runCommand
      ?? ((command, args) => runCommand(command, args, environment, context.platform)),
    probeMcp: context.overrides?.probeMcp ?? probeMcp,
    onlineCheck: context.onlineCheck,
  };
}

function parseSetupCommand(argv: string[]): { action: 'install' | 'doctor'; online: boolean } {
  const action = argv[0];
  if (action !== 'install' && action !== 'doctor') {
    throw new ValidationError('Usage: kooyahq mcp install|doctor --client codex [--online]');
  }
  let client: string | undefined;
  let online = false;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--client') {
      client = argv[index + 1];
      index += 1;
    } else if (token === '--online') {
      online = true;
    } else {
      throw new ValidationError(`Unknown MCP setup option ${token ?? ''}.`);
    }
  }
  if (client !== 'codex') throw new ValidationError('MCP setup currently supports --client codex only.');
  if (action === 'install' && online) {
    throw new ValidationError('--online is supported only by kooyahq mcp doctor.');
  }
  return { action, online };
}

function formatDoctorReport(report: DoctorReport): SetupCommandResult {
  const lines = report.checks.map(
    (check) => `${check.ok ? 'PASS' : 'FAIL'}  ${check.name}: ${check.message}`,
  );
  return report.ok
    ? { exitCode: 0, stdout: lines, stderr: [] }
    : { exitCode: 2, stdout: [], stderr: lines };
}
