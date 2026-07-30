import {
  commandRegistrationCheck,
  localMcpHandshakeCheck,
  localMcpTargetCheck,
  onlineStatusCheck,
  projectGateCheck,
  requireCommandRegistrationAbsent,
  requireLocalMcpDescriptor,
} from './local-client.js';
import type { DoctorReport, SetupDependencies } from './types.js';

const CLIENT_NAME = 'OpenClaw';

export async function installOpenClawIntegration(dependencies: SetupDependencies): Promise<void> {
  const descriptor = await requireLocalMcpDescriptor(dependencies);
  await requireCommandRegistrationAbsent(
    dependencies,
    CLIENT_NAME,
    dependencies.openclawCommand,
    ['mcp', 'show', 'kooyahq'],
    () => false,
    `openclaw mcp add kooyahq --command ${descriptor.command} --arg ${descriptor.args[0]}`,
  );
}

export async function doctorOpenClawIntegration(
  dependencies: SetupDependencies,
  online: boolean,
): Promise<DoctorReport> {
  const checks = [
    await localMcpTargetCheck(dependencies),
    await commandRegistrationCheck(
      dependencies,
      CLIENT_NAME,
      dependencies.openclawCommand,
      ['mcp', 'doctor', 'kooyahq', '--probe'],
    ),
    await localMcpHandshakeCheck(dependencies),
    projectGateCheck(),
  ];
  if (online) checks.push(await onlineStatusCheck(dependencies));
  return { ok: checks.every((check) => check.ok), checks };
}
