import { join } from 'node:path';
import { installJsonMcpEntry, readJsonMcpConfig } from './json-config.js';
import { localMcpDescriptor, localMcpEntryMatches, localMcpHandshakeCheck, localMcpTargetCheck, onlineStatusCheck, projectGateCheck, requireLocalMcpDescriptor, } from './local-client.js';
const CLIENT_NAME = 'Cursor';
export async function installCursorIntegration(dependencies) {
    const descriptor = await requireLocalMcpDescriptor(dependencies);
    await installJsonMcpEntry(cursorConfigPath(dependencies), descriptor, CLIENT_NAME);
}
export async function doctorCursorIntegration(dependencies, online) {
    const checks = [
        await localMcpTargetCheck(dependencies),
        await registrationCheck(dependencies),
        await localMcpHandshakeCheck(dependencies),
        projectGateCheck(),
    ];
    if (online)
        checks.push(await onlineStatusCheck(dependencies));
    return { ok: checks.every((check) => check.ok), checks };
}
function cursorConfigPath(dependencies) {
    return join(dependencies.homeDirectory, '.cursor', 'mcp.json');
}
async function registrationCheck(dependencies) {
    try {
        const config = await readJsonMcpConfig(cursorConfigPath(dependencies), CLIENT_NAME);
        return localMcpEntryMatches(config.mcpServers?.kooyahq, localMcpDescriptor(dependencies))
            ? {
                name: 'Cursor registration',
                ok: true,
                message: 'Cursor uses the expected absolute stdio command on this operating system.',
            }
            : { name: 'Cursor registration', ok: false, message: 'Cursor has no current KooyaHQ MCP entry.' };
    }
    catch {
        return {
            name: 'Cursor registration',
            ok: false,
            message: 'Cursor configuration could not be read safely.',
        };
    }
}
//# sourceMappingURL=cursor.js.map