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

export interface McpServerStreams {
  input: Readable;
  output: Writable;
  error: Writable;
}

const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export function runMcpServer(
  dependencies: McpBridgeDependencies,
  streams: McpServerStreams = {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
  },
): void {
  const parser = new McpFrameParser(async (message) => {
    const response = await handleMcpMessage(message, dependencies);
    if (!response) return;
    streams.output.write(encodeFrame(response));
  });

  streams.input.on('data', (chunk: Buffer | string) => {
    parser.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  streams.input.on('error', (error) => {
    streams.error.write(`${error.message}\n`);
  });
}

export async function handleMcpMessage(
  message: JsonRpcMessage,
  dependencies: McpBridgeDependencies,
): Promise<JsonRpcSuccess | JsonRpcError | undefined> {
  if (message.id === undefined) return undefined;
  try {
    return success(message.id, await routeMcpMessage(message, dependencies));
  } catch (error) {
    return failure(message.id, -32000, publicErrorMessage(error));
  }
}

async function routeMcpMessage(
  message: JsonRpcMessage,
  dependencies: McpBridgeDependencies,
): Promise<Record<string, unknown>> {
  if (message.method === 'initialize') {
    const params = recordOrEmpty(message.params);
    const protocolVersion = typeof params.protocolVersion === 'string'
      ? params.protocolVersion
      : DEFAULT_PROTOCOL_VERSION;
    return {
      protocolVersion,
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
    if (typeof params.name !== 'string') throw new Error('tools/call requires params.name.');
    const result = await callMcpTool(params.name, params.arguments, dependencies);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
      structuredContent: result,
    };
  }

  throw new Error(`Unsupported MCP method ${message.method ?? '[missing]'}.`);
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

function encodeFrame(message: JsonRpcSuccess | JsonRpcError): string {
  const payload = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
}

class McpFrameParser {
  private buffer = Buffer.alloc(0);
  private draining = false;

  constructor(private readonly onMessage: (message: JsonRpcMessage) => Promise<void>) {}

  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.draining) void this.drain();
  }

  private async drain(): Promise<void> {
    this.draining = true;
    try {
      while (this.buffer.length > 0) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const headers = this.buffer.subarray(0, headerEnd).toString('utf8');
        const contentLength = contentLengthFrom(headers);
        if (contentLength === undefined) {
          this.buffer = Buffer.alloc(0);
          return;
        }
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + contentLength;
        if (this.buffer.length < bodyEnd) return;
        const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8');
        this.buffer = this.buffer.subarray(bodyEnd);
        await this.onMessage(JSON.parse(body) as JsonRpcMessage);
      }
    } finally {
      this.draining = false;
    }
  }
}

function contentLengthFrom(headers: string): number | undefined {
  for (const line of headers.split('\r\n')) {
    const [name, rawValue] = line.split(':', 2);
    if (name?.toLocaleLowerCase() !== 'content-length') continue;
    const value = Number(rawValue?.trim());
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  return undefined;
}
