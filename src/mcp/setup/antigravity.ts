import { join } from 'node:path';

import { installJsonMcpEntry, readJsonMcpConfig } from './json-config.js';
import {
  localMcpDescriptor,
  localMcpEntryMatches,
  localMcpHandshakeCheck,
  localMcpTargetCheck,
  onlineStatusCheck,
  projectGateCheck,
  requireLocalMcpDescriptor,
} from './local-client.js';
import type { DoctorCheck, DoctorReport, SetupDependencies } from './types.js';

const CLIENT_NAME = 'Antigravity';

export async function installAntigravityIntegration(dependencies: SetupDependencies): Promise<void> {
  const descriptor = await requireLocalMcpDescriptor(dependencies);
  await installJsonMcpEntry(antigravityConfigPath(dependencies), descriptor, CLIENT_NAME);
}

export async function doctorAntigravityIntegration(
  dependencies: SetupDependencies,
  online: boolean,
): Promise<DoctorReport> {
  const checks = [
    await localMcpTargetCheck(dependencies),
    await registrationCheck(dependencies),
    await localMcpHandshakeCheck(dependencies),
    projectGateCheck(),
  ];
  if (online) checks.push(await onlineStatusCheck(dependencies));
  return { ok: checks.every((check) => check.ok), checks };
}

function antigravityConfigPath(dependencies: SetupDependencies): string {
  return join(dependencies.homeDirectory, '.gemini', 'config', 'mcp_config.json');
}

async function registrationCheck(dependencies: SetupDependencies): Promise<DoctorCheck> {
  try {
    const config = await readJsonMcpConfig(antigravityConfigPath(dependencies), CLIENT_NAME);
    return localMcpEntryMatches(config.mcpServers?.kooyahq, localMcpDescriptor(dependencies))
      ? {
        name: 'Antigravity registration',
        ok: true,
        message: 'Antigravity uses the expected absolute stdio command.',
      }
      : {
        name: 'Antigravity registration',
        ok: false,
        message: 'Antigravity has no current KooyaHQ MCP entry.',
      };
  } catch {
    return {
      name: 'Antigravity registration',
      ok: false,
      message: 'Antigravity configuration could not be read safely.',
    };
  }
}
