import { requireLocalMcpDescriptor } from './local-client.js';
import { hermesManualRegistrationMessages } from './hermes.js';
import { openClawManualRegistrationMessages } from './openclaw.js';
import type { ManualMcpClient, SetupDependencies } from './types.js';

export async function manualRegistrationMessages(
  client: ManualMcpClient,
  dependencies: SetupDependencies,
): Promise<string[]> {
  const descriptor = await requireLocalMcpDescriptor(dependencies);
  return client === 'openclaw'
    ? openClawManualRegistrationMessages(descriptor)
    : hermesManualRegistrationMessages(descriptor);
}
