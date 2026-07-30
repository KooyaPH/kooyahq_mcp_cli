import { access, constants } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { ConfigError } from '../../core/errors.js';
import { SUPPORTED_MCP_PROTOCOL_VERSION } from '../server.js';
const EXPECTED_TOOLS = ['kooyahq_status', 'kooyahq_discover', 'kooyahq_call'];
export function localMcpDescriptor(dependencies) {
    return {
        command: dependencies.nodeExecutable,
        args: [join(dependencies.packageRoot, 'dist', 'bin', 'kooyahq-mcp.js')],
    };
}
export async function requireLocalMcpDescriptor(dependencies) {
    const descriptor = localMcpDescriptor(dependencies);
    if (!isAbsolute(descriptor.command) || !isAbsolute(descriptor.args[0])) {
        throw new ConfigError('KooyaHQ MCP registration requires absolute executable paths.');
    }
    try {
        await Promise.all([
            access(descriptor.command, constants.R_OK),
            access(descriptor.args[0], constants.R_OK),
        ]);
    }
    catch {
        throw new ConfigError('The installed Node.js or KooyaHQ MCP target is missing. Reinstall kooyahq-cli first.');
    }
    return descriptor;
}
export async function localMcpTargetCheck(dependencies) {
    try {
        await requireLocalMcpDescriptor(dependencies);
        return {
            name: 'Package and executable targets',
            ok: true,
            message: 'Absolute Node.js and KooyaHQ MCP targets are readable.',
        };
    }
    catch {
        return {
            name: 'Package and executable targets',
            ok: false,
            message: 'The installed Node.js or KooyaHQ MCP target is missing.',
        };
    }
}
export function localMcpEntryMatches(value, descriptor) {
    if (!isRecord(value))
        return false;
    const keys = Object.keys(value);
    return keys.length === 2
        && keys.includes('command')
        && keys.includes('args')
        && value.command === descriptor.command
        && Array.isArray(value.args)
        && value.args.length === 1
        && value.args[0] === descriptor.args[0];
}
export async function localMcpHandshakeCheck(dependencies) {
    const descriptor = localMcpDescriptor(dependencies);
    try {
        const result = await dependencies.probeMcp(descriptor.command, descriptor.args[0], dependencies.environment);
        const exact = result.protocolVersion === SUPPORTED_MCP_PROTOCOL_VERSION
            && arraysEqual(result.tools, EXPECTED_TOOLS);
        return exact
            ? { name: 'MCP handshake', ok: true, message: 'MCP handshake returned the exact three KooyaHQ tools.' }
            : { name: 'MCP handshake', ok: false, message: 'MCP protocol or tool list does not match this package.' };
    }
    catch {
        return { name: 'MCP handshake', ok: false, message: 'MCP server did not complete a local stdio handshake.' };
    }
}
export async function onlineStatusCheck(dependencies) {
    try {
        const authenticated = await dependencies.onlineCheck();
        return authenticated
            ? { name: 'Online status', ok: true, message: 'Authenticated KooyaHQ profile check succeeded.' }
            : { name: 'Online status', ok: false, message: 'Authenticated KooyaHQ profile check failed.' };
    }
    catch {
        return { name: 'Online status', ok: false, message: 'Authenticated KooyaHQ profile check failed.' };
    }
}
export function projectGateCheck() {
    return {
        name: 'MCP project gate',
        ok: true,
        message: 'The KooyaHQ MCP bridge requires an exact live project catalog match for mutations.',
    };
}
export async function runRegistrationCommand(dependencies, clientName, command, args) {
    let result;
    try {
        result = await dependencies.runCommand(command, args);
    }
    catch (error) {
        if (isMissingExecutable(error)) {
            throw new ConfigError(`${clientName} CLI was not found. Install ${clientName} before configuring KooyaHQ MCP.`);
        }
        throw new ConfigError(`Unable to register KooyaHQ MCP with ${clientName}.`);
    }
    if (result.status !== 0) {
        throw new ConfigError(`Unable to register KooyaHQ MCP with ${clientName}.`);
    }
}
export async function requireCommandRegistrationAbsent(dependencies, clientName, command, args, isProvenAbsent, manualRegistration) {
    let result;
    try {
        result = await dependencies.runCommand(command, args);
    }
    catch (error) {
        if (isMissingExecutable(error)) {
            throw new ConfigError(`${clientName} CLI was not found. Install ${clientName} before configuring KooyaHQ MCP.`);
        }
        throw new ConfigError(`${clientName} MCP registration could not be read safely; no changes were made.`);
    }
    if (isProvenAbsent(result))
        return;
    if (result.status === 0) {
        throw new ConfigError(`${clientName} has an existing kooyahq MCP registration that cannot be verified safely; no changes were made.`);
    }
    throw new ConfigError(`${clientName} cannot prove that kooyahq is absent; no changes were made. Complete manual registration after verifying the current client state: ${manualRegistration}.`);
}
export async function unverifiableCommandRegistrationCheck(dependencies, clientName, command, args) {
    try {
        await dependencies.runCommand(command, args);
        return {
            name: `${clientName} registration`,
            ok: false,
            message: `${clientName} cannot verify the exact KooyaHQ MCP registration from this command output.`,
        };
    }
    catch (error) {
        return isMissingExecutable(error)
            ? { name: `${clientName} registration`, ok: false, message: `${clientName} CLI was not found.` }
            : {
                name: `${clientName} registration`,
                ok: false,
                message: `${clientName} cannot verify the exact KooyaHQ MCP registration from this command output.`,
            };
    }
}
function isMissingExecutable(error) {
    return Boolean(error)
        && typeof error === 'object'
        && error.code === 'ENOENT';
}
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
//# sourceMappingURL=local-client.js.map