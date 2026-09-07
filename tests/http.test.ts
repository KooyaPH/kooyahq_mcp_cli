import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import test from 'node:test';

import { ApiClient, buildHttpsRequestOptions } from '../src/http/client.js';

test('default HTTPS transport forces IPv4 DNS lookup for backend requests', () => {
  const options = buildHttpsRequestOptions(
    new URL('https://hq-be.kooyaai.com/api/cli/v1/projects?limit=1'),
    'GET',
    new Headers({ accept: 'application/json' }),
  );

  assert.equal(options.hostname, 'hq-be.kooyaai.com');
  assert.equal(options.family, 4);
  assert.equal(options.servername, 'hq-be.kooyaai.com');
  assert.equal(options.path, '/api/cli/v1/projects?limit=1');
});

test('default transport supports an allowed HTTP localhost origin', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const client = new ApiClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      version: '1.0.0',
      retryDelayMs: 1,
    });
    assert.deepEqual(await client.request('GET', '/whoami'), { ok: true });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('native transport sends a JSON body on DELETE requests', async () => {
  let receivedBody = '';
  let receivedLength: string | undefined;
  const server = createServer((request, response) => {
    receivedLength = request.headers['content-length'];
    request.setEncoding('utf8');
    request.on('data', (chunk) => { receivedBody += chunk; });
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const client = new ApiClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      version: '1.0.0',
      retryDelayMs: 1,
    });
    const body = { url: 'https://example.com/café' };

    assert.deepEqual(await client.request('DELETE', '/tickets/1/documents', { body }), { ok: true });
    assert.equal(receivedBody, JSON.stringify(body));
    assert.equal(receivedLength, String(Buffer.byteLength(JSON.stringify(body))));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('native transport destroys timed-out sockets and bounds GET retries', async () => {
  let requests = 0;
  const openSockets = new Set<Socket>();
  const server = createServer(() => {
    requests += 1;
  });
  server.on('connection', (socket) => {
    openSockets.add(socket);
    socket.on('close', () => openSockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const client = new ApiClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      version: '1.0.0',
      timeoutMs: 15,
      retryDelayMs: 1,
    });

    await assert.rejects(client.request('GET', '/projects'), /Unable to reach/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(requests >= 1 && requests <= 3, `observed ${requests} native requests`);
    assert.equal(openSockets.size, 0);
  } finally {
    for (const socket of openSockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('sends the exact authorization and user-agent headers and rejects redirects', async () => {
  let captured: { input: string; init: RequestInit } | undefined;
  const client = new ApiClient({
    baseUrl: 'https://example.com',
    accessKeyId: 'access-id',
    secretAccessKey: 'secret-value',
    version: '1.2.3',
    platform: 'linux',
    nodeVersion: '20.15.0',
    fetch: async (input, init) => {
      captured = { input: String(input), init: init ?? {} };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.request('GET', '/projects', { query: { page: 2, search: 'red & blue' } });

  assert.equal(captured?.input, 'https://example.com/api/cli/v1/projects?page=2&search=red+%26+blue');
  assert.equal(new Headers(captured?.init.headers).get('authorization'), 'KooyaKey access-id:secret-value');
  assert.equal(new Headers(captured?.init.headers).get('user-agent'), 'kooyahq-cli/1.2.3 (linux; node/20.15.0)');
  assert.equal(captured?.init.redirect, 'error');
});

test('omits undefined query parameters and JSON encodes request bodies', async () => {
  let captured: { input: string; init: RequestInit } | undefined;
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0', platform: 'win32', nodeVersion: '18.20.0',
    fetch: async (input, init) => {
      captured = { input: String(input), init: init ?? {} };
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  await client.request('POST', '/projects', {
    query: { page: undefined, limit: 20 },
    body: { name: 'Internal' },
  });

  assert.equal(captured?.input, 'https://example.com/api/cli/v1/projects?limit=20');
  assert.equal(captured?.init.body, '{"name":"Internal"}');
  assert.equal(new Headers(captured?.init.headers).get('content-type'), 'application/json');
});

test('redacts credentials reflected by an API error', async () => {
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'visible-id', secretAccessKey: 'hidden-secret',
    version: '1.0.0',
    fetch: async () => new Response(JSON.stringify({
      message: 'Rejected visible-id with hidden-secret',
    }), { status: 401, headers: { 'content-type': 'application/json' } }),
  });

  await assert.rejects(
    client.request('GET', '/whoami'),
    (error: Error) => {
      assert.doesNotMatch(error.message, /visible-id|hidden-secret/);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
});

test('times out requests with AbortController before surfacing a network error', async () => {
  let capturedSignal: AbortSignal | undefined;
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0', timeoutMs: 1,
    fetch: async (_input, init) => {
      capturedSignal = init?.signal ?? undefined;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  await assert.rejects(client.request('GET', '/whoami'), /Unable to reach/);
  assert.equal(capturedSignal?.aborted, true);
});

test('retries transient GET transport failures before surfacing a network error', async () => {
  let calls = 0;
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0',
    fetch: async () => {
      calls += 1;
      if (calls < 3) throw new Error('temporary timeout');
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
    retryDelayMs: 1,
  });

  await client.request('GET', '/projects');

  assert.equal(calls, 3);
});

test('bounds failed GET requests to three total transport attempts', async () => {
  let calls = 0;
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0', retryDelayMs: 1,
    fetch: async () => {
      calls += 1;
      throw new Error('temporary timeout');
    },
  });

  await assert.rejects(client.request('GET', '/projects'), /Unable to reach/);
  assert.equal(calls, 3);
});

test('does not retry non-GET transport failures', async () => {
  let calls = 0;
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0',
    fetch: async () => {
      calls += 1;
      throw new Error('temporary timeout');
    },
    retryDelayMs: 1,
  });

  await assert.rejects(client.request('POST', '/projects', { body: { name: 'Internal' } }), /Unable to reach/);

  assert.equal(calls, 1);
});

test('rejects oversized responses before parsing JSON', async () => {
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0', maxResponseBytes: 10,
    fetch: async () => new Response(JSON.stringify({ data: 'too large' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  });

  await assert.rejects(client.request('GET', '/projects'), /too large/);
});

test('returns bounded text responses for explicit export commands', async () => {
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0',
    fetch: async () => new Response('name,email\nUser,user@example.com', {
      status: 200,
      headers: { 'content-type': 'text/csv' },
    }),
  });

  assert.equal(
    await client.request('GET', '/users/export', { query: { format: 'csv' } }),
    'name,email\nUser,user@example.com',
  );
});

test('rejects malformed JSON responses as a protocol error', async () => {
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'id', secretAccessKey: 'secret',
    version: '1.0.0',
    fetch: async () => new Response('{"data":', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  });

  await assert.rejects(client.request('GET', '/projects'), /invalid JSON/);
});

test('extracts nested API error messages safely', async () => {
  const client = new ApiClient({
    baseUrl: 'https://example.com', accessKeyId: 'visible-id', secretAccessKey: 'hidden-secret',
    version: '1.0.0',
    fetch: async () => new Response(JSON.stringify({
      error: { message: 'Permission denied for visible-id using hidden-secret' },
    }), { status: 403, headers: { 'content-type': 'application/json' } }),
  });

  await assert.rejects(
    client.request('GET', '/users'),
    (error: Error) => {
      assert.match(error.message, /Permission denied/);
      assert.doesNotMatch(error.message, /visible-id|hidden-secret/);
      return true;
    },
  );
});

test('rejects an unsafe base URL before calling fetch', async () => {
  let calls = 0;
  assert.throws(() => new ApiClient({
    baseUrl: 'http://example.com', accessKeyId: 'id', secretAccessKey: 'secret', version: '1.0.0',
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  }), /HTTPS/);
  assert.equal(calls, 0);
});
