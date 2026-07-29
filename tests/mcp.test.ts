import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';

import { callMcpTool, mcpToolDefinitions, type McpBridgeDependencies } from '../src/mcp/bridge.js';
import {
  handleMcpMessage,
  MAX_MCP_LINE_BYTES,
  runMcpServer,
} from '../src/mcp/server.js';

function dependencies(overrides: Partial<McpBridgeDependencies> = {}): McpBridgeDependencies {
  return {
    environment: {},
    homeDirectory: '/missing-home',
    platform: 'linux',
    version: '0.3.0',
    fetch: async () => {
      throw new Error('network must not be called');
    },
    prompt: async () => {
      throw new Error('MCP must not prompt');
    },
    readInputFile: async () => {
      throw new Error('MCP must not read files');
    },
    readStandardInput: async () => {
      throw new Error('MCP must provide bounded stdin itself');
    },
    output: { stdout: () => undefined, stderr: () => undefined },
    ...overrides,
  };
}

test('MCP exposes a compact stable tool surface', () => {
  assert.deepEqual(mcpToolDefinitions().map((tool) => tool.name), [
    'kooyahq_status',
    'kooyahq_discover',
    'kooyahq_call',
  ]);
  const commandProperty = mcpToolDefinitions()[2]?.inputSchema.properties.command as { type?: string } | undefined;
  assert.equal(commandProperty?.type, 'string');
});

test('MCP discovery returns existing command skill schema without credentials or network traffic', async () => {
  let networkCalls = 0;
  const result = await callMcpTool('kooyahq_discover', { scope: 'tickets create' }, dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
  }));

  assert.equal(networkCalls, 0);
  assert.equal((result as { command: string }).command, 'tickets create');
  assert.equal((result as { schemaVersion: number }).schemaVersion, 2);
});

test('MCP status refuses missing configuration before network traffic', async () => {
  let networkCalls = 0;
  await assert.rejects(
    callMcpTool('kooyahq_status', {}, dependencies({
      fetch: async () => {
        networkCalls += 1;
        return new Response('{}');
      },
    })),
    /configured/i,
  );
  assert.equal(networkCalls, 0);
});

test('MCP call maps structured arguments to KooyaHQ API requests with MCP user-agent', async () => {
  let captured: { input: string; init: RequestInit } | undefined;
  const result = await callMcpTool('kooyahq_call', {
    command: 'tickets list',
    args: {
      'board-id': '507f1f77bcf86cd799439011',
      search: 'release',
      limit: 2,
    },
  }, dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async (input, init) => {
      captured = { input: String(input), init: init ?? {} };
      return new Response(JSON.stringify({ data: [{ id: 'ticket-1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  }));

  const url = new URL(captured?.input ?? '');
  assert.equal(`${url.origin}${url.pathname}`, 'https://example.com/api/cli/v1/tickets');
  assert.equal(url.searchParams.get('boardId'), '507f1f77bcf86cd799439011');
  assert.equal(url.searchParams.get('search'), 'release');
  assert.equal(url.searchParams.get('limit'), '2');
  assert.equal(
    new Headers(captured?.init.headers).get('user-agent'),
    `kooyahq-mcp/0.3.0 (linux; node/${process.versions.node})`,
  );
  assert.deepEqual(result, { data: [{ id: 'ticket-1' }] });
});

test('MCP mutations require explicit confirmation before network traffic', async () => {
  let networkCalls = 0;
  await assert.rejects(
    callMcpTool('kooyahq_call', {
      command: 'tickets create',
      args: {
        'board-id': '507f1f77bcf86cd799439011',
        'ticket-type': 'task',
        title: 'Release',
      },
    }, dependencies({
      fetch: async () => {
        networkCalls += 1;
        return new Response('{}');
      },
    })),
    /confirm/,
  );
  assert.equal(networkCalls, 0);
});

test('MCP dry-run validates mutations without credentials or network traffic', async () => {
  let networkCalls = 0;
  const result = await callMcpTool('kooyahq_call', {
    command: 'tickets create',
    confirm: true,
    dryRun: true,
    args: {
      'board-id': '507f1f77bcf86cd799439011',
      'ticket-type': 'task',
      title: 'Release',
    },
  }, dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
  }));

  assert.equal(networkCalls, 0);
  assert.deepEqual(result, {
    method: 'POST',
    path: '/tickets',
    query: {},
    body: {
      boardId: '507f1f77bcf86cd799439011',
      ticketType: 'task',
      title: 'Release',
    },
  });
});

test('MCP ticket imports use bounded structured input instead of filesystem reads', async () => {
  let capturedBody: unknown;
  const result = await callMcpTool('kooyahq_call', {
    command: 'tickets import preview',
    confirm: true,
    args: {
      'board-id': '507f1f77bcf86cd799439011',
      input: [{ importRef: 'T-1', title: 'Release', ticketType: 'task' }],
    },
  }, dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ operationId: 'op-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  }));

  assert.deepEqual(capturedBody, {
    boardId: '507f1f77bcf86cd799439011',
    rows: [{ importRef: 'T-1', title: 'Release', ticketType: 'task' }],
  });
  assert.deepEqual(result, { operationId: 'op-1' });
});

test('MCP JSON-RPC route exposes initialize, tools/list, and tools/call', async () => {
  const initialized = await handleMcpMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  }, dependencies());
  assert.equal(initialized?.jsonrpc, '2.0');
  assert.equal(initialized?.id, 1);
  assert.ok(initialized && 'result' in initialized);
  const initializeResult = initialized.result as { serverInfo: { name: string } };
  assert.equal(initializeResult.serverInfo.name, 'kooyahq-mcp');

  const listed = await handleMcpMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  }, dependencies());
  assert.ok(listed && 'result' in listed);
  const listResult = listed.result as { tools: Array<{ name: string }> };
  assert.deepEqual(
    listResult.tools.map((tool) => tool.name),
    ['kooyahq_status', 'kooyahq_discover', 'kooyahq_call'],
  );

  const called = await handleMcpMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'kooyahq_discover',
      arguments: { scope: 'notifications list' },
    },
  }, dependencies());
  assert.ok(called && 'result' in called);
  const result = called.result as { structuredContent: { command: string } };
  assert.equal(result.structuredContent.command, 'notifications list');
});

test('MCP initialize rejects unsupported protocol versions instead of echoing them', async () => {
  const initialized = await handleMcpMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2099-01-01' },
  }, dependencies());

  assert.ok(initialized && 'error' in initialized);
  assert.equal(initialized.error.code, -32602);
  assert.match(initialized.error.message, /unsupported MCP protocol version/i);
});

test('MCP server replaces oversized tool output with a bounded error preserving the request id', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const error = new PassThrough();
  const marker = 'must-not-leak-from-oversized-response';
  const lines = collectLines(output);
  runMcpServer(dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async () => new Response(JSON.stringify({
      data: [{ value: `${marker}${'x'.repeat(MAX_MCP_LINE_BYTES)}` }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  }), { input, output, error });

  input.write(`${JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  input.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 42,
    method: 'tools/call',
    params: { name: 'kooyahq_call', arguments: { command: 'projects list' } },
  })}\n`);

  const initialized = await lines.next();
  assert.ok(Buffer.byteLength(initialized, 'utf8') <= MAX_MCP_LINE_BYTES);
  assert.equal(JSON.parse(initialized).id, 1);
  const oversized = await lines.next();
  assert.ok(Buffer.byteLength(oversized, 'utf8') <= MAX_MCP_LINE_BYTES);
  const response = JSON.parse(oversized) as {
    id: number;
    error?: { code: number; message: string };
  };
  assert.equal(response.id, 42);
  assert.equal(response.error?.code, -32603);
  assert.match(response.error?.message ?? '', /response exceeds/i);
  assert.doesNotMatch(oversized, new RegExp(marker));
});

test('MCP server rejects a boundary-sized request id with a bounded id-null response', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const error = new PassThrough();
  const lines = collectLines(output);
  runMcpServer(dependencies(), { input, output, error });

  const requestWithoutId = {
    jsonrpc: '2.0',
    id: '',
    method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  };
  const envelopeBytes = Buffer.byteLength(JSON.stringify(requestWithoutId), 'utf8');
  const marker = 'boundary-id-content-should-not-leak-';
  const pathologicalId = marker
    + 'i'.repeat(MAX_MCP_LINE_BYTES - envelopeBytes - marker.length - 1);
  const request = JSON.stringify({ ...requestWithoutId, id: pathologicalId });
  assert.ok(Buffer.byteLength(request, 'utf8') <= MAX_MCP_LINE_BYTES);
  input.write(`${request}\n`);

  const responseLine = await lines.next();
  assert.ok(Buffer.byteLength(responseLine, 'utf8') <= MAX_MCP_LINE_BYTES);
  const response = JSON.parse(responseLine) as {
    id: string | null;
    error?: { code: number; message: string };
  };
  assert.equal(response.id, null);
  assert.equal(response.error?.code, -32600);
  assert.match(response.error?.message ?? '', /request id/i);
  assert.doesNotMatch(responseLine, /boundary-id-content-should-not-leak/);
});

test('MCP server pauses input while a response is backpressured', async () => {
  const input = new TrackingInput();
  const output = new BlockingOutput();
  const error = new PassThrough();
  runMcpServer(dependencies(), { input, output, error });
  const initialResumeCalls = input.resumeCalls;

  input.write(`${JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  })}\n`);
  await waitFor(() => input.pauseCalls > 0 && output.chunks.length === 1);
  input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n${JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/list',
  })}\n`);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(output.chunks.length, 1);
  assert.equal(input.resumeCalls, initialResumeCalls);

  output.release();
  await waitFor(() => input.resumeCalls > initialResumeCalls && output.chunks.length === 2);
  const second = JSON.parse(output.chunks[1] ?? '{}') as { id?: number };
  assert.equal(second.id, 2);
  output.release();
});

function collectLines(stream: PassThrough): { next: () => Promise<string> } {
  let buffer = '';
  const queue: string[] = [];
  const waiters: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  let failure: Error | undefined;
  stream.setEncoding('utf8').on('data', (chunk: string) => {
    if (failure) return;
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (Buffer.byteLength(line, 'utf8') > MAX_MCP_LINE_BYTES) {
        failure = new Error('MCP test response exceeded the line bound.');
        for (const waiter of waiters.splice(0)) waiter.reject(failure);
        return;
      }
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(line);
      else queue.push(line);
      newline = buffer.indexOf('\n');
    }
    if (Buffer.byteLength(buffer, 'utf8') > MAX_MCP_LINE_BYTES) {
      failure = new Error('MCP test response exceeded the line bound without a newline.');
      for (const waiter of waiters.splice(0)) waiter.reject(failure);
    }
  });
  return {
    next: async () => {
      const line = queue.shift();
      if (line !== undefined) return line;
      if (failure) throw failure;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for MCP test output.')), 5_000);
        waiters.push({
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
    },
  };
}

class TrackingInput extends PassThrough {
  pauseCalls = 0;
  resumeCalls = 0;

  override pause(): this {
    this.pauseCalls += 1;
    return super.pause();
  }

  override resume(): this {
    this.resumeCalls += 1;
    return super.resume();
  }
}

class BlockingOutput extends Writable {
  readonly chunks: string[] = [];
  private callbacks: Array<() => void> = [];

  constructor() {
    super({ highWaterMark: 1 });
  }

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(chunk.toString('utf8').trimEnd());
    this.callbacks.push(callback);
  }

  release(): void {
    this.callbacks.shift()?.();
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for test condition.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
