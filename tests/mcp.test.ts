import assert from 'node:assert/strict';
import test from 'node:test';

import { callMcpTool, mcpToolDefinitions, type McpBridgeDependencies } from '../src/mcp/bridge.js';
import { handleMcpMessage } from '../src/mcp/server.js';

function dependencies(overrides: Partial<McpBridgeDependencies> = {}): McpBridgeDependencies {
  return {
    environment: {},
    homeDirectory: '/missing-home',
    platform: 'linux',
    version: '0.2.0',
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
    `kooyahq-mcp/0.2.0 (linux; node/${process.versions.node})`,
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
