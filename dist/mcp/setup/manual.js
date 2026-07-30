import { requireLocalMcpDescriptor } from './local-client.js';
import { hermesManualRegistrationMessages } from './hermes.js';
import { openClawManualRegistrationMessages } from './openclaw.js';
export async function manualRegistrationMessages(client, dependencies) {
    const descriptor = await requireLocalMcpDescriptor(dependencies);
    return client === 'openclaw'
        ? openClawManualRegistrationMessages(descriptor)
        : hermesManualRegistrationMessages(descriptor);
}
//# sourceMappingURL=manual.js.map