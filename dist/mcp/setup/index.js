import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationError } from '../../core/errors.js';
import { doctorAntigravityIntegration, installAntigravityIntegration } from './antigravity.js';
import { doctorClaudeIntegration, installClaudeIntegration } from './claude.js';
import { doctorCodexIntegration, installCodexIntegration } from './codex.js';
import { doctorCursorIntegration, installCursorIntegration } from './cursor.js';
import { doctorGeminiIntegration, installGeminiIntegration } from './gemini.js';
import { manualRegistrationMessages } from './manual.js';
import { clientExecutable, codexExecutable, probeMcp, runCommand } from './process.js';
export { doctorAntigravityIntegration, installAntigravityIntegration } from './antigravity.js';
export { doctorClaudeIntegration, installClaudeIntegration } from './claude.js';
export { doctorCodexIntegration, installCodexIntegration } from './codex.js';
export { doctorCursorIntegration, installCursorIntegration } from './cursor.js';
export { doctorGeminiIntegration, installGeminiIntegration } from './gemini.js';
export async function runMcpSetupCommand(argv, context) {
    const parsed = parseSetupCommand(argv);
    const dependencies = setupDependencies(context, parsed.action === 'manual' ? undefined : parsed.client);
    if (parsed.action === 'manual') {
        return {
            exitCode: 0,
            stdout: await manualRegistrationMessages(parsed.client, dependencies),
            stderr: [],
        };
    }
    const integration = clientIntegrations[parsed.client];
    if (parsed.action === 'install') {
        await integration.install(dependencies);
        return {
            exitCode: 0,
            stdout: installationMessages[parsed.client],
            stderr: [],
        };
    }
    const report = await integration.doctor(dependencies, parsed.online);
    return formatDoctorReport(report);
}
function setupDependencies(context, client) {
    const packageRoot = context.overrides?.packageRoot
        ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const nodeExecutable = context.overrides?.nodeExecutable ?? process.execPath;
    const configuredCodexRoot = context.environment.CODEX_HOME;
    if (client === 'codex' && configuredCodexRoot && !isAbsolute(configuredCodexRoot)) {
        throw new ValidationError('CODEX_HOME must be an absolute path.');
    }
    const codexRoot = client === 'codex' && configuredCodexRoot
        ? configuredCodexRoot
        : join(context.homeDirectory, '.codex');
    const environment = client === 'codex'
        ? { ...context.environment, CODEX_HOME: codexRoot }
        : { ...context.environment };
    return {
        homeDirectory: context.homeDirectory,
        codexRoot,
        codexCommand: codexExecutable(context.platform),
        claudeCommand: clientExecutable(context.platform, 'claude'),
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
function parseSetupCommand(argv) {
    const action = argv[0];
    if (action !== 'install' && action !== 'doctor' && action !== 'manual') {
        throw new ValidationError(`Usage: kooyahq mcp install|doctor --client ${mcpClientList()} [--online], or kooyahq mcp manual --client ${manualMcpClientList()}.`);
    }
    let client;
    let online = false;
    for (let index = 1; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--client') {
            client = argv[index + 1];
            index += 1;
        }
        else if (token === '--online') {
            online = true;
        }
        else {
            throw new ValidationError(`Unknown MCP setup option ${token ?? ''}.`);
        }
    }
    if (action === 'manual') {
        if (!isManualMcpClient(client)) {
            throw new ValidationError(`Manual MCP guidance supports --client ${manualMcpClientList()}.`);
        }
        if (online) {
            throw new ValidationError('--online is supported only by kooyahq mcp doctor.');
        }
        return { action, client, online: false };
    }
    if (isManualMcpClient(client)) {
        throw new ValidationError(`${manualClientName(client)} supports manual registration only. Run kooyahq mcp manual --client ${client}.`);
    }
    if (!isMcpClient(client)) {
        throw new ValidationError(`MCP setup supports --client ${mcpClientList()}.`);
    }
    if (action === 'install' && online) {
        throw new ValidationError('--online is supported only by kooyahq mcp doctor.');
    }
    return { action, client, online };
}
const clientIntegrations = {
    codex: { install: installCodexIntegration, doctor: doctorCodexIntegration },
    cursor: { install: installCursorIntegration, doctor: doctorCursorIntegration },
    claude: { install: installClaudeIntegration, doctor: doctorClaudeIntegration },
    gemini: { install: installGeminiIntegration, doctor: doctorGeminiIntegration },
    antigravity: { install: installAntigravityIntegration, doctor: doctorAntigravityIntegration },
};
const installationMessages = {
    codex: [
        'KooyaHQ MCP and the kooyahq-cli skill are installed for Codex.',
        'Restart Codex, then open a new thread so the MCP tools and skill are reloaded.',
    ],
    cursor: [
        'KooyaHQ MCP is installed for Cursor on this operating system.',
        'Restart this operating system’s Cursor client, then run cursor-agent mcp list to confirm its tools are reloaded.',
    ],
    claude: [
        'KooyaHQ MCP is installed for Claude Code.',
        'Restart Claude Code before opening a new MCP-enabled session.',
    ],
    gemini: [
        'KooyaHQ MCP is installed for Gemini CLI.',
        'Restart Gemini CLI before opening a new MCP-enabled session.',
    ],
    antigravity: [
        'KooyaHQ MCP is installed for Google Antigravity.',
        'Restart Google Antigravity before opening a new MCP-enabled session.',
    ],
};
function isMcpClient(value) {
    return value === 'codex'
        || value === 'cursor'
        || value === 'claude'
        || value === 'gemini'
        || value === 'antigravity';
}
function mcpClientList() {
    return 'codex|cursor|claude|gemini|antigravity';
}
function isManualMcpClient(value) {
    return value === 'openclaw' || value === 'hermes';
}
function manualMcpClientList() {
    return 'openclaw|hermes';
}
function manualClientName(client) {
    return client === 'openclaw' ? 'OpenClaw' : 'Hermes';
}
function formatDoctorReport(report) {
    const lines = report.checks.map((check) => `${check.ok ? 'PASS' : 'FAIL'}  ${check.name}: ${check.message}`);
    return report.ok
        ? { exitCode: 0, stdout: lines, stderr: [] }
        : { exitCode: 2, stdout: [], stderr: lines };
}
//# sourceMappingURL=index.js.map