import { join } from 'node:path';
import { installJsonMcpEntry, readJsonMcpConfig } from './json-config.js';
import { localMcpDescriptor, localMcpEntryMatches, localMcpHandshakeCheck, localMcpTargetCheck, onlineStatusCheck, projectGateCheck, requireLocalMcpDescriptor, } from './local-client.js';
const CLIENT_NAME = 'Gemini CLI';
export async function installGeminiIntegration(dependencies) {
    const descriptor = await requireLocalMcpDescriptor(dependencies);
    await installJsonMcpEntry(geminiConfigPath(dependencies), descriptor, CLIENT_NAME);
}
export async function doctorGeminiIntegration(dependencies, online) {
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
function geminiConfigPath(dependencies) {
    return join(dependencies.homeDirectory, '.gemini', 'settings.json');
}
async function registrationCheck(dependencies) {
    try {
        const config = await readJsonMcpConfig(geminiConfigPath(dependencies), CLIENT_NAME);
        return localMcpEntryMatches(config.mcpServers?.kooyahq, localMcpDescriptor(dependencies))
            ? {
                name: 'Gemini CLI registration',
                ok: true,
                message: 'Gemini CLI uses the expected absolute stdio command.',
            }
            : {
                name: 'Gemini CLI registration',
                ok: false,
                message: 'Gemini CLI has no current KooyaHQ MCP entry.',
            };
    }
    catch {
        return {
            name: 'Gemini CLI registration',
            ok: false,
            message: 'Gemini CLI configuration could not be read safely.',
        };
    }
}
//# sourceMappingURL=gemini.js.map