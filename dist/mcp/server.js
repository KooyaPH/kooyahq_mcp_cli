import { TextDecoder } from 'node:util';
import { once } from 'node:events';
import { publicErrorMessage } from '../core/errors.js';
import { callMcpTool, mcpToolDefinitions } from './bridge.js';
export const SUPPORTED_MCP_PROTOCOL_VERSION = '2025-06-18';
export const MAX_MCP_LINE_BYTES = 1024 * 1024;
const OVERSIZED_RESPONSE_MESSAGE = `MCP response exceeds the ${MAX_MCP_LINE_BYTES}-byte line limit.`;
const FALLBACK_ENVELOPE_BYTES = Buffer.byteLength(JSON.stringify({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32603, message: OVERSIZED_RESPONSE_MESSAGE },
}), 'utf8') - Buffer.byteLength('null', 'utf8');
const MAX_JSON_RPC_ID_BYTES = MAX_MCP_LINE_BYTES - FALLBACK_ENVELOPE_BYTES;
export function runMcpServer(dependencies, streams = {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
}) {
    const lifecycle = { initializeAccepted: false, initialized: false };
    const write = async (response) => {
        if (!streams.output.write(`${encodeBoundedResponse(response)}\n`)) {
            await once(streams.output, 'drain');
        }
    };
    const parser = new McpLineParser(async (message) => {
        const response = await handleMcpMessage(message, dependencies, lifecycle);
        if (response)
            await write(response);
    }, async () => write(failure(null, -32700, 'Parse error. Each MCP message must be one valid UTF-8 JSON line.')));
    streams.input.on('data', (chunk) => {
        streams.input.pause();
        void parser.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            .catch(() => streams.error.write('MCP processing error.\n'))
            .finally(() => streams.input.resume());
    });
    streams.input.on('error', (error) => {
        streams.error.write(`MCP input error: ${error.message}\n`);
    });
}
export async function handleMcpMessage(message, dependencies, lifecycle) {
    const idIsAcceptable = acceptableId(message.id);
    const id = idIsAcceptable && message.id !== undefined ? message.id : null;
    if (!idIsAcceptable)
        return failure(null, -32600, 'Invalid JSON-RPC request id.');
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
        return message.id === undefined ? undefined : failure(id, -32600, 'Invalid JSON-RPC request.');
    }
    if (message.method === 'notifications/initialized') {
        if (lifecycle?.initializeAccepted)
            lifecycle.initialized = true;
        return undefined;
    }
    if (message.id === undefined)
        return undefined;
    if (lifecycle && message.method !== 'initialize' && !lifecycle.initialized) {
        return failure(message.id, -32002, 'MCP server is not initialized.');
    }
    try {
        const result = await routeMcpMessage(message, dependencies);
        if (lifecycle && message.method === 'initialize')
            lifecycle.initializeAccepted = true;
        return success(message.id, result);
    }
    catch (error) {
        if (error instanceof McpRequestError)
            return failure(message.id, error.code, error.message);
        return failure(message.id, -32000, publicErrorMessage(error));
    }
}
async function routeMcpMessage(message, dependencies) {
    if (message.method === 'initialize') {
        const params = recordOrEmpty(message.params);
        if (params.protocolVersion !== SUPPORTED_MCP_PROTOCOL_VERSION) {
            throw new McpRequestError(-32602, `Unsupported MCP protocol version. This server supports ${SUPPORTED_MCP_PROTOCOL_VERSION}.`);
        }
        return {
            protocolVersion: SUPPORTED_MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: {
                name: 'kooyahq-mcp',
                version: dependencies.version,
            },
        };
    }
    if (message.method === 'tools/list') {
        return { tools: mcpToolDefinitions() };
    }
    if (message.method === 'tools/call') {
        const params = recordOrEmpty(message.params);
        if (typeof params.name !== 'string') {
            throw new McpRequestError(-32602, 'tools/call requires params.name.');
        }
        const result = await callMcpTool(params.name, params.arguments, dependencies);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
            structuredContent: result,
        };
    }
    throw new McpRequestError(-32601, `Unsupported MCP method ${message.method ?? '[missing]'}.`);
}
function success(id, result) {
    return { jsonrpc: '2.0', id, result };
}
function failure(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
}
function recordOrEmpty(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    return value;
}
function acceptableId(value) {
    const validType = value === undefined || value === null || typeof value === 'string'
        || (typeof value === 'number' && Number.isFinite(value));
    if (!validType || value === undefined)
        return validType;
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_JSON_RPC_ID_BYTES;
}
function encodeBoundedResponse(response) {
    const encoded = JSON.stringify(response);
    if (Buffer.byteLength(encoded, 'utf8') <= MAX_MCP_LINE_BYTES)
        return encoded;
    const correlatedFallback = JSON.stringify(failure(response.id, -32603, OVERSIZED_RESPONSE_MESSAGE));
    if (Buffer.byteLength(correlatedFallback, 'utf8') <= MAX_MCP_LINE_BYTES) {
        return correlatedFallback;
    }
    return JSON.stringify(failure(null, -32603, 'MCP response exceeded the line limit.'));
}
class McpRequestError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
class McpLineParser {
    onMessage;
    onParseError;
    buffer = Buffer.alloc(0);
    discardingOversizedLine = false;
    queue = Promise.resolve();
    constructor(onMessage, onParseError) {
        this.onMessage = onMessage;
        this.onParseError = onParseError;
    }
    push(chunk) {
        let offset = 0;
        while (offset < chunk.length) {
            if (this.discardingOversizedLine) {
                const newline = chunk.indexOf(0x0a, offset);
                if (newline === -1)
                    return this.queue;
                this.discardingOversizedLine = false;
                offset = newline + 1;
                continue;
            }
            const newline = chunk.indexOf(0x0a, offset);
            const end = newline === -1 ? chunk.length : newline;
            const fragment = chunk.subarray(offset, end);
            if (this.buffer.length + fragment.length > MAX_MCP_LINE_BYTES) {
                this.buffer = Buffer.alloc(0);
                this.enqueueParseError();
                if (newline === -1) {
                    this.discardingOversizedLine = true;
                    return this.queue;
                }
            }
            else {
                this.buffer = this.buffer.length === 0
                    ? Buffer.from(fragment)
                    : Buffer.concat([this.buffer, fragment]);
                if (newline !== -1)
                    this.enqueueLine(this.buffer);
            }
            if (newline === -1)
                return this.queue;
            this.buffer = Buffer.alloc(0);
            offset = newline + 1;
        }
        return this.queue;
    }
    enqueueLine(line) {
        this.queue = this.queue.then(async () => {
            try {
                const normalized = line.at(-1) === 0x0d ? line.subarray(0, -1) : line;
                const decoded = new TextDecoder('utf-8', { fatal: true }).decode(normalized);
                const parsed = JSON.parse(decoded);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                    throw new Error('invalid');
                await this.onMessage(parsed);
            }
            catch {
                await this.onParseError();
            }
        });
    }
    enqueueParseError() {
        this.queue = this.queue.then(async () => this.onParseError());
    }
}
//# sourceMappingURL=server.js.map