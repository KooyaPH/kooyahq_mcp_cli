import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { ConfigError } from '../../core/errors.js';
import { localMcpEntryMatches } from './local-client.js';
export async function readJsonMcpConfig(path, clientName) {
    let text;
    try {
        text = await readFile(path, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return {};
        throw new ConfigError(`${clientName} MCP configuration could not be read safely; no changes were made.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new ConfigError(`${clientName} MCP configuration is not valid JSON; no changes were made.`);
    }
    if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers))) {
        throw new ConfigError(`${clientName} MCP configuration has an unsupported structure; no changes were made.`);
    }
    return parsed;
}
export async function installJsonMcpEntry(path, descriptor, clientName) {
    const config = await readJsonMcpConfig(path, clientName);
    const existing = config.mcpServers?.kooyahq;
    if (existing !== undefined && !localMcpEntryMatches(existing, descriptor)) {
        throw new ConfigError(`${clientName} has an existing kooyahq MCP registration that cannot be verified safely; no changes were made.`);
    }
    if (existing !== undefined)
        return;
    await writeJsonAtomic(path, {
        ...config,
        mcpServers: {
            ...(config.mcpServers ?? {}),
            kooyahq: { command: descriptor.command, args: descriptor.args },
        },
    }, clientName);
}
async function writeJsonAtomic(path, value, clientName) {
    const directory = dirname(path);
    const temporary = join(directory, `.${basename(path)}.${randomUUID()}.tmp`);
    try {
        await mkdir(directory, { recursive: true });
        await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
        await rename(temporary, path);
    }
    catch {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw new ConfigError(`${clientName} MCP configuration could not be written atomically.`);
    }
}
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
//# sourceMappingURL=json-config.js.map