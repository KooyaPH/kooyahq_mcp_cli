import { access, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { ConfigError } from '../../core/errors.js';
import { SUPPORTED_MCP_PROTOCOL_VERSION } from '../server.js';
import { localMcpDescriptor } from './local-client.js';
import { commandRequiresShell, windowsShellArgumentsAreSafe } from './process.js';
import { installSkill } from './skill.js';
import type { DoctorCheck, DoctorReport, SetupDependencies } from './types.js';

const EXPECTED_TOOLS = ['kooyahq_status', 'kooyahq_discover', 'kooyahq_call'];

interface CodexServer {
  name?: string;
  enabled?: boolean;
  disabled_reason?: string | null;
  enabled_tools?: string[] | null;
  disabled_tools?: string[] | null;
  startup_timeout_sec?: number | null;
  tool_timeout_sec?: number | null;
  transport?: {
    type?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string> | null;
    env_vars?: string[];
    cwd?: string | null;
    url?: string;
    bearer_token_env_var?: string | null;
    http_headers?: Record<string, string> | null;
    env_http_headers?: Record<string, string> | null;
  };
}

const CODEX_SERVER_FIELDS = new Set([
  'name', 'enabled', 'disabled_reason', 'transport', 'enabled_tools', 'disabled_tools',
  'startup_timeout_sec', 'tool_timeout_sec',
]);
const STDIO_TRANSPORT_FIELDS = new Set(['type', 'command', 'args', 'env', 'env_vars', 'cwd']);
const HTTP_TRANSPORT_FIELDS = new Set([
  'type', 'url', 'bearer_token_env_var', 'http_headers', 'env_http_headers',
]);
const NOT_FOUND_MESSAGE = "Error: No MCP server named 'kooyahq' found.";

export async function installCodexIntegration(dependencies: SetupDependencies): Promise<void> {
  const scriptPath = mcpScriptPath(dependencies);
  await requireInstallTargets(dependencies.nodeExecutable, scriptPath);
  const desiredArguments = desiredAddArguments(dependencies, scriptPath);
  if (
    commandRequiresShell(dependencies.platform, dependencies.codexCommand)
    && !windowsShellArgumentsAreSafe([dependencies.codexCommand, ...desiredArguments])
  ) {
    throw new ConfigError(
      'The Codex command or KooyaHQ install path cannot be quoted safely on Windows; no changes were made.',
    );
  }
  const previous = await readCodexServer(dependencies);
  const registrationChanged = !registrationMatches(previous, dependencies.nodeExecutable, scriptPath);
  if (registrationChanged) assertRestorable(previous, dependencies.platform);
  if (registrationChanged && previous?.transport && !restoreArguments(previous.transport)) {
    throw new ConfigError(
      'The existing kooyahq MCP transport cannot be restored safely; no changes were made.',
    );
  }

  if (registrationChanged) {
    try {
      await removeCodexServer(dependencies, previous !== undefined);
      const added = await dependencies.runCommand(
        dependencies.codexCommand,
        desiredArguments,
      );
      if (added.status !== 0) throw new ConfigError('Unable to register KooyaHQ MCP with Codex.');
    } catch (error) {
      const restored = await restoreCodexServer(dependencies, previous);
      if (!restored) {
        throw new ConfigError(
          'Unable to register KooyaHQ MCP and unable to restore the previous kooyahq entry.',
        );
      }
      if (error instanceof ConfigError) throw error;
      throw new ConfigError('Unable to register KooyaHQ MCP with Codex.');
    }
  }

  try {
    await installSkill(dependencies.packageRoot, join(dependencies.codexRoot, 'skills'));
  } catch (error) {
    const restored = !registrationChanged || await restoreCodexServer(dependencies, previous);
    if (!restored) {
      throw new ConfigError(
        'Unable to install the KooyaHQ Codex skill and unable to restore the previous kooyahq entry.',
      );
    }
    throw new ConfigError('Unable to install the KooyaHQ Codex skill.');
  }
}

export async function doctorCodexIntegration(
  dependencies: SetupDependencies,
  online: boolean,
): Promise<DoctorReport> {
  const scriptPath = mcpScriptPath(dependencies);
  const checks: DoctorCheck[] = [];

  checks.push(await fileCheck(
    'Package and executable targets',
    dependencies.nodeExecutable,
    scriptPath,
  ));
  checks.push(await registrationCheck(dependencies, scriptPath));
  checks.push(await handshakeCheck(dependencies, scriptPath));
  checks.push(await skillCheck(dependencies));
  if (online) checks.push(await authenticatedCheck(dependencies));

  return { ok: checks.every((check) => check.ok), checks };
}

function mcpScriptPath(dependencies: SetupDependencies): string {
  return localMcpDescriptor(dependencies).args[0];
}

async function requireInstallTargets(nodeExecutable: string, scriptPath: string): Promise<void> {
  if (!isAbsolute(nodeExecutable) || !isAbsolute(scriptPath)) {
    throw new ConfigError('KooyaHQ MCP registration requires absolute executable paths.');
  }
  try {
    await access(nodeExecutable);
    await access(scriptPath);
  } catch {
    throw new ConfigError(
      'The installed Node.js or KooyaHQ MCP target is missing. Reinstall kooyahq-cli first.',
    );
  }
}

async function fileCheck(
  name: string,
  nodeExecutable: string,
  scriptPath: string,
): Promise<DoctorCheck> {
  try {
    await requireInstallTargets(nodeExecutable, scriptPath);
    return { name, ok: true, message: 'Absolute Node.js and KooyaHQ MCP targets are readable.' };
  } catch {
    return { name, ok: false, message: 'The installed Node.js or KooyaHQ MCP target is missing.' };
  }
}

async function registrationCheck(
  dependencies: SetupDependencies,
  scriptPath: string,
): Promise<DoctorCheck> {
  let result;
  try {
    result = await dependencies.runCommand(
      dependencies.codexCommand,
      ['mcp', 'get', 'kooyahq', '--json'],
    );
  } catch {
    return { name: 'Codex registration', ok: false, message: 'Codex CLI was not found.' };
  }
  if (result.status !== 0) {
    return !result.stdout.trim() && result.stderr.trim() === NOT_FOUND_MESSAGE
      ? { name: 'Codex registration', ok: false, message: 'Codex has no kooyahq MCP entry.' }
      : { name: 'Codex registration', ok: false, message: 'Codex registration could not be read safely.' };
  }
  const parsed = parseCodexServer(result.stdout);
  const exact = parsed?.transport?.type === 'stdio'
    && parsed.transport.command === dependencies.nodeExecutable
    && arraysEqual(parsed.transport.args ?? [], [scriptPath]);
  return exact
    ? { name: 'Codex registration', ok: true, message: 'Codex uses the expected absolute stdio command.' }
    : { name: 'Codex registration', ok: false, message: 'Codex kooyahq entry is stale or targets another command.' };
}

async function handshakeCheck(
  dependencies: SetupDependencies,
  scriptPath: string,
): Promise<DoctorCheck> {
  try {
    const result = await dependencies.probeMcp(
      dependencies.nodeExecutable,
      scriptPath,
      dependencies.environment,
    );
    const exact = result.protocolVersion === SUPPORTED_MCP_PROTOCOL_VERSION
      && arraysEqual(result.tools, EXPECTED_TOOLS);
    return exact
      ? { name: 'MCP handshake', ok: true, message: 'MCP handshake returned the exact three KooyaHQ tools.' }
      : { name: 'MCP handshake', ok: false, message: 'MCP protocol or tool list does not match this package.' };
  } catch {
    return { name: 'MCP handshake', ok: false, message: 'MCP server did not complete a local stdio handshake.' };
  }
}

async function skillCheck(dependencies: SetupDependencies): Promise<DoctorCheck> {
  try {
    const version = (await readFile(
      join(dependencies.codexRoot, 'skills', 'kooyahq-cli', 'VERSION'),
      'utf8',
    )).trim();
    return version === dependencies.version
      ? { name: 'Codex skill', ok: true, message: `KooyaHQ CLI skill ${version} is installed.` }
      : { name: 'Codex skill', ok: false, message: 'Installed KooyaHQ CLI skill version is stale.' };
  } catch {
    return { name: 'Codex skill', ok: false, message: 'KooyaHQ CLI skill is not installed.' };
  }
}

async function authenticatedCheck(dependencies: SetupDependencies): Promise<DoctorCheck> {
  try {
    const ok = await dependencies.onlineCheck();
    return ok
      ? { name: 'Online status', ok: true, message: 'Authenticated KooyaHQ profile check succeeded.' }
      : { name: 'Online status', ok: false, message: 'Authenticated KooyaHQ profile check failed.' };
  } catch {
    return { name: 'Online status', ok: false, message: 'Authenticated KooyaHQ profile check failed.' };
  }
}

async function readCodexServer(dependencies: SetupDependencies): Promise<CodexServer | undefined> {
  let result;
  try {
    result = await dependencies.runCommand(
      dependencies.codexCommand,
      ['mcp', 'get', 'kooyahq', '--json'],
    );
  } catch {
    throw new ConfigError('Codex CLI was not found. Install Codex before configuring KooyaHQ MCP.');
  }
  if (result.status !== 0) {
    if (!result.stdout.trim() && result.stderr.trim() === NOT_FOUND_MESSAGE) return undefined;
    throw new ConfigError('Unable to read the existing kooyahq MCP configuration; no changes were made.');
  }
  const parsed = parseCodexServer(result.stdout);
  if (!parsed?.transport) {
    throw new ConfigError('Codex returned an unreadable kooyahq MCP configuration; no changes were made.');
  }
  return parsed;
}

function parseCodexServer(output: string): CodexServer | undefined {
  try {
    const parsed = JSON.parse(output) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as CodexServer : undefined;
  } catch {
    return undefined;
  }
}

function assertRestorable(server: CodexServer | undefined, platform: NodeJS.Platform): void {
  if (!server) return;
  const unsupportedRoot = Object.keys(server).filter((field) => !CODEX_SERVER_FIELDS.has(field));
  const hasUnsupportedRootValue = server.enabled === false
    || server.disabled_reason != null
    || server.enabled_tools != null
    || server.disabled_tools != null
    || server.startup_timeout_sec != null
    || server.tool_timeout_sec != null;
  const transport = server.transport;
  if (!transport) throwUnsupported();
  const allowedTransportFields = transport.type === 'stdio'
    ? STDIO_TRANSPORT_FIELDS
    : transport.type === 'streamable_http'
      ? HTTP_TRANSPORT_FIELDS
      : undefined;
  const unsupportedTransport = allowedTransportFields
    ? Object.keys(transport).filter((field) => !allowedTransportFields.has(field))
    : ['type'];
  const hasUnsupportedTransportValue = transport.type === 'stdio'
    ? Boolean(transport.cwd || (transport.env_vars?.length ?? 0) > 0)
    : Boolean(
      transport.http_headers && Object.keys(transport.http_headers).length > 0
      || transport.env_http_headers && Object.keys(transport.env_http_headers).length > 0,
    );
  if (
    unsupportedRoot.length > 0
    || hasUnsupportedRootValue
    || unsupportedTransport.length > 0
    || hasUnsupportedTransportValue
  ) {
    throwUnsupported();
  }
  const restoration = restoreArguments(transport);
  if (
    commandRequiresShell(platform, 'codex.cmd')
    && restoration
    && !windowsShellArgumentsAreSafe(['codex.cmd', ...restoration])
  ) {
    throwUnsupported();
  }
}

function throwUnsupported(): never {
  throw new ConfigError(
    'The existing kooyahq MCP entry has unsupported settings that cannot be restored; no changes were made.',
  );
}

async function removeCodexServer(
  dependencies: SetupDependencies,
  mustSucceed = false,
): Promise<void> {
  const result = await dependencies.runCommand(
    dependencies.codexCommand,
    ['mcp', 'remove', 'kooyahq'],
  );
  if (mustSucceed && result.status !== 0) {
    throw new ConfigError('Unable to remove the existing kooyahq MCP entry.');
  }
}

async function restoreCodexServer(
  dependencies: SetupDependencies,
  previous: CodexServer | undefined,
): Promise<boolean> {
  try {
    await removeCodexServer(dependencies);
    if (!previous?.transport) return true;
    const args = restoreArguments(previous.transport);
    if (!args) return false;
    return (await dependencies.runCommand(dependencies.codexCommand, args)).status === 0;
  } catch {
    return false;
  }
}

function desiredAddArguments(dependencies: SetupDependencies, scriptPath: string): string[] {
  return ['mcp', 'add', 'kooyahq', '--', dependencies.nodeExecutable, scriptPath];
}

function restoreArguments(transport: NonNullable<CodexServer['transport']>): string[] | undefined {
  if (transport.type === 'stdio' && transport.command) {
    const environment = Object.entries(transport.env ?? {})
      .flatMap(([name, value]) => ['--env', `${name}=${value}`]);
    return [
      'mcp', 'add', ...environment, 'kooyahq', '--', transport.command, ...(transport.args ?? []),
    ];
  }
  if (transport.type === 'streamable_http' && transport.url) {
    return [
      'mcp', 'add', 'kooyahq', '--url', transport.url,
      ...(transport.bearer_token_env_var
        ? ['--bearer-token-env-var', transport.bearer_token_env_var]
        : []),
    ];
  }
  return undefined;
}

function registrationMatches(
  server: CodexServer | undefined,
  nodeExecutable: string,
  scriptPath: string,
): boolean {
  return server?.transport?.type === 'stdio'
    && server.transport.command === nodeExecutable
    && arraysEqual(server.transport.args ?? [], [scriptPath]);
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
