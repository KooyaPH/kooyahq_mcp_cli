import { TextDecoder } from 'node:util';
import { once } from 'node:events';
import type { Readable, Writable } from 'node:stream';

import { publicErrorMessage } from '../core/errors.js';
import type { McpBridgeDependencies } from './bridge.js';
import { callMcpTool, mcpToolDefinitions } from './bridge.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRpcId = string | number | null;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: JsonValue | Record<string, unknown>;
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
  };
}

interface McpLifecycle {
  initializeAccepted: boolean;
  initialized: boolean;
}

export interface McpServerStreams {
  input: Readable;
  output: Writable;
  error: Writable;
}

export const SUPPORTED_MCP_PROTOCOL_VERSION = '2025-06-18';
export const MAX_MCP_LINE_BYTES = 1024 * 1024;
const OVERSIZED_RESPONSE_MESSAGE = `MCP response exceeds the ${MAX_MCP_LINE_BYTES}-byte line limit.`;
const FALLBACK_ENVELOPE_BYTES = Buffer.byteLength(JSON.stringify({
  jsonrpc: '2.0',
  id: null,
  error: { code: -32603, message: OVERSIZED_RESPONSE_MESSAGE },
}), 'utf8') - Buffer.byteLength('null', 'utf8');
const MAX_JSON_RPC_ID_BYTES = MAX_MCP_LINE_BYTES - FALLBACK_ENVELOPE_BYTES;

export function runMcpServer(
  dependencies: McpBridgeDependencies,
  streams: McpServerStreams = {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
  },
): void {
  const lifecycle: McpLifecycle = { initializeAccepted: false, initialized: false };
  const write = async (response: JsonRpcSuccess | JsonRpcError): Promise<void> => {
    if (!streams.output.write(`${encodeBoundedResponse(response)}\n`)) {
      await once(streams.output, 'drain');
    }
  };
  const parser = new McpLineParser(
    async (message) => {
      const response = await handleMcpMessage(message, dependencies, lifecycle);
      if (response) await write(response);
    },
    async () => write(failure(
      null,
      -32700,
      'Parse error. Each MCP message must be one valid UTF-8 JSON line.',
    )),
  );

  streams.input.on('data', (chunk: Buffer | string) => {
    streams.input.pause();
    void parser.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      .catch(() => streams.error.write('MCP processing error.\n'))
      .finally(() => streams.input.resume());
  });
  streams.input.on('error', (error) => {
    streams.error.write(`MCP input error: ${error.message}\n`);
  });
}

export async function handleMcpMessage(
  message: JsonRpcMessage,
  dependencies: McpBridgeDependencies,
  lifecycle?: McpLifecycle,
): Promise<JsonRpcSuccess | JsonRpcError | undefined> {
  const idIsAcceptable = acceptableId(message.id);
  const id: JsonRpcId = idIsAcceptable && message.id !== undefined ? message.id : null;
  if (!idIsAcceptable) return failure(null, -32600, 'Invalid JSON-RPC request id.');
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return message.id === undefined ? undefined : failure(id, -32600, 'Invalid JSON-RPC request.');
  }

  if (message.method === 'notifications/initialized') {
    if (lifecycle?.initializeAccepted) lifecycle.initialized = true;
    return undefined;
  }
  if (message.id === undefined) return undefined;
  if (lifecycle && message.method !== 'initialize' && !lifecycle.initialized) {
    return failure(message.id, -32002, 'MCP server is not initialized.');
  }

  try {
    const result = await routeMcpMessage(message, dependencies);
    if (lifecycle && message.method === 'initialize') lifecycle.initializeAccepted = true;
    return success(message.id, result);
  } catch (error) {
    if (error instanceof McpRequestError) return failure(message.id, error.code, error.message);
    return failure(message.id, -32000, publicErrorMessage(error));
  }
}

async function routeMcpMessage(
  message: JsonRpcMessage,
  dependencies: McpBridgeDependencies,
): Promise<Record<string, unknown>> {
  if (message.method === 'initialize') {
    const params = recordOrEmpty(message.params);
    if (params.protocolVersion !== SUPPORTED_MCP_PROTOCOL_VERSION) {
      throw new McpRequestError(
        -32602,
        `Unsupported MCP protocol version. This server supports ${SUPPORTED_MCP_PROTOCOL_VERSION}.`,
      );
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

function success(id: JsonRpcId, result: JsonRpcSuccess['result']): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

function failure(id: JsonRpcId, code: number, message: string): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function acceptableId(value: unknown): value is JsonRpcId | undefined {
  const validType = value === undefined || value === null || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value));
  if (!validType || value === undefined) return validType;
  return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_JSON_RPC_ID_BYTES;
}

function encodeBoundedResponse(response: JsonRpcSuccess | JsonRpcError): string {
  const encoded = JSON.stringify(response);
  if (Buffer.byteLength(encoded, 'utf8') <= MAX_MCP_LINE_BYTES) return encoded;

  const correlatedFallback = JSON.stringify(failure(
    response.id,
    -32603,
    OVERSIZED_RESPONSE_MESSAGE,
  ));
  if (Buffer.byteLength(correlatedFallback, 'utf8') <= MAX_MCP_LINE_BYTES) {
    return correlatedFallback;
  }

  return JSON.stringify(failure(null, -32603, 'MCP response exceeded the line limit.'));
}

class McpRequestError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

class McpLineParser {
  private buffer = Buffer.alloc(0);
  private discardingOversizedLine = false;
  private queue = Promise.resolve();

  constructor(
    private readonly onMessage: (message: JsonRpcMessage) => Promise<void>,
    private readonly onParseError: () => Promise<void>,
  ) {}

  push(chunk: Buffer): Promise<void> {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.discardingOversizedLine) {
        const newline = chunk.indexOf(0x0a, offset);
        if (newline === -1) return this.queue;
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
      } else {
        this.buffer = this.buffer.length === 0
          ? Buffer.from(fragment)
          : Buffer.concat([this.buffer, fragment]);
        if (newline !== -1) this.enqueueLine(this.buffer);
      }
      if (newline === -1) return this.queue;
      this.buffer = Buffer.alloc(0);
      offset = newline + 1;
    }
    return this.queue;
  }

  private enqueueLine(line: Buffer): void {
    this.queue = this.queue.then(async () => {
      try {
        const normalized = line.at(-1) === 0x0d ? line.subarray(0, -1) : line;
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(normalized);
        const parsed = JSON.parse(decoded) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
        await this.onMessage(parsed as JsonRpcMessage);
      } catch {
        await this.onParseError();
      }
    });
  }

  private enqueueParseError(): void {
    this.queue = this.queue.then(async () => this.onParseError());
  }
}
