import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface, type Interface } from 'node:readline';
import test from 'node:test';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const MAX_MCP_LINE_BYTES = 1024 * 1024;
// The executable is launched through tsx while the full suite starts other TypeScript workers.
// Keep this above observed cold-start contention so it tests protocol recovery, not compilation speed.
const MCP_RESPONSE_TIMEOUT_MS = 15_000;

interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

test('MCP executable speaks newline-delimited JSON through initialize and tools/list', async (t) => {
  const server = startServer(t);

  send(server.child, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  });
  const initialized = await server.next();
  assert.equal(initialized.result?.protocolVersion, '2025-06-18');
  assert.equal(server.rawLines[0]?.startsWith('{'), true);

  send(server.child, { jsonrpc: '2.0', method: 'notifications/initialized' });
  send(server.child, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const listed = await server.next();
  const tools = listed.result?.tools as Array<{ name: string }>;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'kooyahq_status',
    'kooyahq_discover',
    'kooyahq_call',
  ]);
});

test('MCP executable rejects unsupported negotiation and requires initialization lifecycle', async (t) => {
  const server = startServer(t);

  send(server.child, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal((await server.next()).error?.code, -32002);

  send(server.child, {
    jsonrpc: '2.0',
    id: 2,
    method: 'initialize',
    params: { protocolVersion: '2099-01-01' },
  });
  const unsupported = await server.next();
  assert.equal(unsupported.error?.code, -32602);
  assert.match(unsupported.error?.message ?? '', /unsupported MCP protocol version/i);
});

test('MCP executable safely recovers from malformed and oversized input lines', async (t) => {
  const server = startServer(t);

  server.child.stdin.write('not-json\n');
  server.child.stdin.write(`${'x'.repeat(MAX_MCP_LINE_BYTES + 1)}\n`);
  send(server.child, {
    jsonrpc: '2.0',
    id: 3,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  });

  assert.equal((await server.next()).error?.code, -32700);
  assert.equal((await server.next()).error?.code, -32700);
  assert.equal((await server.next()).result?.protocolVersion, '2025-06-18');
});

function startServer(t: test.TestContext): {
  child: ChildProcessWithoutNullStreams;
  next: () => Promise<JsonRpcResponse>;
  rawLines: string[];
} {
  const child = spawn(process.execPath, [tsxCli, 'src/bin/kooyahq-mcp.ts'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = createInterface({ input: child.stdout });
  const rawLines: string[] = [];
  const queue: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  lines.on('line', (line) => {
    rawLines.push(line);
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else queue.push(line);
  });
  t.after(() => {
    lines.close();
    child.kill();
  });

  return {
    child,
    rawLines,
    next: async () => JSON.parse(await nextLine(queue, waiters, child, lines)) as JsonRpcResponse,
  };
}

function send(child: ChildProcessWithoutNullStreams, value: unknown): void {
  child.stdin.write(`${JSON.stringify(value)}\n`);
}

function nextLine(
  queue: string[],
  waiters: Array<(line: string) => void>,
  child: ChildProcessWithoutNullStreams,
  lines: Interface,
): Promise<string> {
  const line = queue.shift();
  if (line !== undefined) return Promise.resolve(line);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for MCP response line.')),
      MCP_RESPONSE_TIMEOUT_MS,
    );
    waiters.push((value) => {
      clearTimeout(timeout);
      resolve(value);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      lines.close();
      reject(new Error(`MCP server exited before responding (${code ?? 'signal'}).`));
    });
  });
}
