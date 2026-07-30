import {
  localMcpTargetCheck,
  onlineStatusCheck,
  projectGateCheck,
  requireCommandRegistrationAbsent,
  requireLocalMcpDescriptor,
  runRegistrationCommand,
  unverifiableCommandRegistrationCheck,
} from './local-client.js';
import type { DoctorReport, SetupDependencies } from './types.js';

const CLIENT_NAME = 'Claude Code';
const CLAUDE_NOT_FOUND_MESSAGE = 'No MCP server named "kooyahq". Run `claude mcp add` to add one.';

export async function installClaudeIntegration(dependencies: SetupDependencies): Promise<void> {
  const descriptor = await requireLocalMcpDescriptor(dependencies);
  await requireCommandRegistrationAbsent(
    dependencies,
    CLIENT_NAME,
    dependencies.claudeCommand,
    ['mcp', 'get', 'kooyahq'],
    (result) => result.status === 1
      && !result.stdout.trim()
      && result.stderr.trim() === CLAUDE_NOT_FOUND_MESSAGE,
    `claude mcp add-json --scope user kooyahq ${JSON.stringify({ type: 'stdio', ...descriptor })}`,
  );
  await runRegistrationCommand(dependencies, CLIENT_NAME, dependencies.claudeCommand, [
    'mcp', 'add-json', '--scope', 'user', 'kooyahq', JSON.stringify({ type: 'stdio', ...descriptor }),
  ]);
}

export async function doctorClaudeIntegration(
  dependencies: SetupDependencies,
  online: boolean,
): Promise<DoctorReport> {
  const checks = [
    await localMcpTargetCheck(dependencies),
    await unverifiableCommandRegistrationCheck(
      dependencies,
      CLIENT_NAME,
      dependencies.claudeCommand,
      ['mcp', 'get', 'kooyahq'],
    ),
    projectGateCheck(),
  ];
  if (online) checks.push(await onlineStatusCheck(dependencies));
  return { ok: checks.every((check) => check.ok), checks };
}
