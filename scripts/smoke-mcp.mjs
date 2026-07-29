import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const child = spawn(process.execPath, ['dist/bin/kooyahq-mcp.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = createInterface({ input: child.stdout });
const timeout = setTimeout(() => fail(new Error('MCP smoke test timed out.')), 5_000);
let stage = 0;

child.once('error', fail);
child.once('exit', (status) => {
  if (stage !== 2) fail(new Error(`MCP smoke server exited early (${status ?? 'signal'}).`));
});
lines.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    if (stage === 0) {
      assert.equal(message.id, 1);
      assert.equal(message.result.protocolVersion, '2025-06-18');
      stage = 1;
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
      return;
    }
    assert.equal(message.id, 2);
    assert.deepEqual(message.result.tools.map((tool) => tool.name), [
      'kooyahq_status', 'kooyahq_discover', 'kooyahq_call',
    ]);
    stage = 2;
    clearTimeout(timeout);
    lines.close();
    child.kill();
  } catch (error) {
    fail(error);
  }
});

child.stdin.write(`${JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18' },
})}\n`);

function fail(error) {
  clearTimeout(timeout);
  lines.close();
  child.kill();
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
