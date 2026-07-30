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

const CLIENT_NAME = 'Hermes';

export async function installHermesIntegration(dependencies: SetupDependencies): Promise<void> {
  const descriptor = await requireLocalMcpDescriptor(dependencies);
  await requireCommandRegistrationAbsent(
    dependencies,
    CLIENT_NAME,
    dependencies.hermesCommand,
    ['mcp', 'test', 'kooyahq'],
    () => false,
    `hermes mcp add kooyahq --command ${descriptor.command} --args ${descriptor.args[0]}`,
  );
}

export async function doctorHermesIntegration(
  dependencies: SetupDependencies,
  online: boolean,
): Promise<DoctorReport> {
  const checks = [
    await localMcpTargetCheck(dependencies),
    await commandRegistrationCheck(
      dependencies,
      CLIENT_NAME,
      dependencies.hermesCommand,
      ['mcp', 'test', 'kooyahq'],
    ),
    await localMcpHandshakeCheck(dependencies),
    projectGateCheck(),
  ];
  if (online) checks.push(await onlineStatusCheck(dependencies));
  return { ok: checks.every((check) => check.ok), checks };
}
