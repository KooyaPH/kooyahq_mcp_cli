import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeConfig } from '../src/config/store.js';
import { defaultDependencies, runCli, type RuntimeDependencies } from '../src/runtime/run.js';

function dependencies(overrides: Partial<RuntimeDependencies> = {}): RuntimeDependencies {
  return {
    environment: {},
    homeDirectory: '/missing-home',
    platform: 'linux',
    version: '0.1.0',
    fetch: async () => {
      throw new Error('network must not be called');
    },
    prompt: async () => '',
    readInputFile: async () => {
      throw new Error('file input must not be read');
    },
    readStandardInput: async () => {
      throw new Error('standard input must not be read');
    },
    output: { stdout: () => undefined, stderr: () => undefined },
    ...overrides,
  };
}

test('installed defaults select the IPv4-capable native transport', () => {
  const defaults = defaultDependencies('0.1.0', async () => '');
  assert.equal(defaults.fetch, undefined);
});

test('does not send network traffic when credentials are missing', async () => {
  let networkCalls = 0;
  const errors: string[] = [];
  const code = await runCli(['projects', 'list'], dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
    output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
  }));
  assert.equal(code, 2);
  assert.equal(networkCalls, 0);
  assert.match(errors.join('\n'), /configure/);
});

test('renders command help before configuration without sending network traffic', async () => {
  let networkCalls = 0;
  const lines: string[] = [];
  const code = await runCli(['tickets', 'create', '--help'], dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));

  assert.equal(code, 0);
  assert.equal(networkCalls, 0);
  assert.match(lines.join('\n'), /tickets create/);
  assert.match(lines.join('\n'), /--board-id/);
  assert.match(lines.join('\n'), /--ticket-type/);
  assert.match(lines.join('\n'), /Summary:/);
  assert.match(lines.join('\n'), /Workflow:/);
  assert.match(lines.join('\n'), /Examples:/);
  assert.match(lines.join('\n'), /Exactly one:/);
  assert.doesNotMatch(lines.join('\n'), /secret-access-key/i);
});

test('resolves command help when command arguments appear before --help', async () => {
  const lines: string[] = [];
  const code = await runCli(
    ['tickets', 'create', '--board-key', 'OPS', '--ticket-type', 'task', '--help'],
    dependencies({
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }),
  );

  assert.equal(code, 0);
  assert.match(lines.join('\n'), /KooyaHQ command: tickets create/);
  assert.doesNotMatch(lines.join('\n'), /KooyaHQ internal command-line client/);
});

test('root and group help list every matching command with a concise summary', async () => {
  for (const argv of [['--help'], ['tickets', '--help']]) {
    const lines: string[] = [];
    const code = await runCli(argv, dependencies({
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }));
    assert.equal(code, 0);
    const output = lines.join('\n');
    assert.match(output, /tickets create\s{2,}/);
    assert.match(output, /Create/i);
  }
});

test('configure help and skills are discoverable offline without exposing secrets', async () => {
  for (const argv of [['configure', '--help'], ['configure', 'show', '--help']]) {
    const lines: string[] = [];
    const code = await runCli(argv, dependencies({
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }));
    assert.equal(code, 0);
    assert.match(lines.join('\n'), /kooyahq configure/);
    assert.doesNotMatch(lines.join('\n'), /secret value|secret-access-key/i);
  }

  const lines: string[] = [];
  const code = await runCli(['--skill', 'configure', '--output', 'json'], dependencies({
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));
  assert.equal(code, 0);
  const document = JSON.parse(lines.join('\n'));
  assert.equal(document.command, 'configure');
  assert.equal(document.authentication.required, false);
  assert.deepEqual(document.subcommands.map((item: { name: string }) => item.name), [
    'configure', 'configure show', 'configure clear',
  ]);
  assert.doesNotMatch(lines.join('\n'), /secretAccessKey|secret-access-key/i);
});

test('renders an agent-readable command skill without configuration or network traffic', async () => {
  let networkCalls = 0;
  const lines: string[] = [];
  const code = await runCli(['--skill', 'tickets', 'create'], dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));

  assert.equal(code, 0);
  assert.equal(networkCalls, 0);
  assert.match(lines.join('\n'), /^# KooyaHQ CLI Skill/m);
  assert.match(lines.join('\n'), /Command: `tickets create`/);
  assert.match(lines.join('\n'), /Authentication/);
  assert.match(lines.join('\n'), /--board-id/);
  assert.match(lines.join('\n'), /--ticket-type/);
  assert.match(lines.join('\n'), /epic\|story\|task\|bug\|subtask/);
  assert.doesNotMatch(lines.join('\n'), /secret-access-key/i);
});

test('renders the command skill as stable JSON for automation', async () => {
  const lines: string[] = [];
  const code = await runCli(
    ['--skill', 'tickets', 'create', '--output', 'json'],
    dependencies({
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }),
  );

  assert.equal(code, 0);
  const document = JSON.parse(lines.join('\n'));
  assert.equal(document.schemaVersion, 2);
  assert.equal(document.command, 'tickets create');
  assert.equal(document.method, 'POST');
  assert.equal(typeof document.summary, 'string');
  assert.equal(typeof document.workflow, 'string');
  assert.ok(Array.isArray(document.examples));
  assert.equal(document.authentication.required, true);
  assert.deepEqual(
    document.parameters.find((parameter: { name: string }) => parameter.name === 'ticket-type').choices,
    ['epic', 'story', 'task', 'bug', 'subtask'],
  );
  assert.equal(
    document.parameters.find((parameter: { name: string }) => parameter.name === 'board-id').required,
    false,
  );
  assert.doesNotMatch(lines.join('\n'), /secretAccessKey|secret-access-key/i);
});

test('renders root and group skills as command discovery documents', async () => {
  for (const argv of [
    ['--skill', '--output', 'json'],
    ['--skill', 'tickets', '--output', 'json'],
  ]) {
    const lines: string[] = [];
    const code = await runCli(argv, dependencies({
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }));
    assert.equal(code, 0);
    const document = JSON.parse(lines.join('\n'));
    assert.equal(document.schemaVersion, 2);
    assert.ok(Array.isArray(document.commands));
    assert.ok(document.commands.some((command: { name: string }) => command.name === 'tickets create'));
    assert.equal(typeof document.workflow, 'string');
  }
});

test('prints a mutation dry run before configuration without sending network traffic', async () => {
  let networkCalls = 0;
  const lines: string[] = [];
  const code = await runCli([
    'tickets', 'create',
    '--board-id', '507f1f77bcf86cd799439011',
    '--ticket-type', 'task',
    '--title', 'Release',
    '--dry-run',
    '--output', 'json',
  ], dependencies({
    fetch: async () => {
      networkCalls += 1;
      return new Response('{}');
    },
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));

  assert.equal(code, 0);
  assert.equal(networkCalls, 0);
  assert.deepEqual(JSON.parse(lines.join('\n')), {
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

test('fetches every page for a paginated list only when --all is explicit', async () => {
  const requestedPages: string[] = [];
  const lines: string[] = [];
  const code = await runCli(
    ['projects', 'list', '--all', '--limit', '2', '--output', 'json'],
    dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
      },
      fetch: async (input) => {
        const url = new URL(String(input));
        const page = url.searchParams.get('page') ?? '1';
        requestedPages.push(page);
        const data = page === '1' ? [{ id: 'p1' }, { id: 'p2' }] : [{ id: 'p3' }];
        return new Response(JSON.stringify({
          data,
          pagination: { page: Number(page), limit: 2, total: 3, totalPages: 2 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }),
  );

  assert.equal(code, 0);
  assert.deepEqual(requestedPages, ['1', '2']);
  assert.deepEqual(JSON.parse(lines.join('\n')).data, [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
});

test('bounds --all at the backend maximum page', async () => {
  const requestedPages: number[] = [];
  const errors: string[] = [];
  const code = await runCli(
    ['projects', 'list', '--all', '--limit', '1', '--output', 'json'],
    dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
      },
      fetch: async (input) => {
        const page = Number(new URL(String(input)).searchParams.get('page'));
        requestedPages.push(page);
        return new Response(JSON.stringify({
          data: [{ id: `p${page}` }],
          pagination: { page, limit: 1, totalPages: 101 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
      output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
    }),
  );

  assert.equal(code, 2);
  assert.equal(requestedPages.length, 100);
  assert.equal(Math.max(...requestedPages), 100);
  assert.match(errors.join('\n'), /exceeded the 100-page safety limit/);
});

test('stops --all before retaining more than the configured item limit', async () => {
  let calls = 0;
  const errors: string[] = [];
  const code = await runCli(
    ['projects', 'list', '--all', '--limit', '2', '--output', 'json'],
    dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
      },
      allPagesLimits: { maxPages: 10, maxItems: 2, maxBytes: 1_000 },
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          data: calls === 1 ? [{ id: 'p1' }, { id: 'p2' }] : [{ id: 'p3' }],
          pagination: { page: calls, limit: 2, totalPages: 2 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
      output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
    }),
  );

  assert.equal(code, 2);
  assert.equal(calls, 2);
  assert.match(errors.join('\n'), /exceeded the 2-item safety limit/);
});

test('stops --all before retaining more than the configured byte limit', async () => {
  const errors: string[] = [];
  const code = await runCli(
    ['projects', 'list', '--all', '--output', 'json'],
    dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
      },
      allPagesLimits: { maxPages: 10, maxItems: 100, maxBytes: 10 },
      fetch: async () => new Response(JSON.stringify({
        data: [{ name: 'larger than ten bytes' }],
        pagination: { page: 1, limit: 100, totalPages: 1 },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
      output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
    }),
  );

  assert.equal(code, 2);
  assert.match(errors.join('\n'), /exceeded the 10-byte safety limit/);
});

test('loads a bounded JSON ticket import file before sending a preview request', async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const code = await runCli([
    'tickets', 'import', 'preview',
    '--board-id', '507f1f77bcf86cd799439011',
    '--file', 'tickets.json',
    '--format', 'json',
    '--output', 'json',
  ], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    readInputFile: async () => Buffer.from(JSON.stringify([
      { title: 'Release', ticketType: 'task' },
    ])),
    fetch: async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ data: { valid: 1 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  } as Partial<RuntimeDependencies> & {
    readInputFile: (path: string) => Promise<Buffer>;
  }));

  assert.equal(code, 0);
  assert.deepEqual(requests, [{
    url: 'https://example.com/api/cli/v1/tickets/import/preview',
    body: {
      boardId: '507f1f77bcf86cd799439011',
      rows: [{ title: 'Release', ticketType: 'task' }],
    },
  }]);
});

test('honors the backend pagination pages field without sending an extra request', async () => {
  let calls = 0;
  const lines: string[] = [];
  const code = await runCli(
    ['projects', 'list', '--all', '--limit', '2', '--output', 'json'],
    dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
      },
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          data: [{ id: 'p1' }, { id: 'p2' }],
          pagination: { page: 1, limit: 2, total: 2, pages: 1 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
      output: { stdout: (value) => lines.push(value), stderr: () => undefined },
    }),
  );

  assert.equal(code, 0);
  assert.equal(calls, 1);
  const response = JSON.parse(lines.join('\n'));
  assert.equal(response.pagination.pages, 1);
  assert.equal(response.pagination.all, true);
});

test('maps API status failures to stable exit codes without exposing credentials', async () => {
  const cases: Array<[number, number]> = [[500, 1], [401, 3], [403, 4], [404, 5], [409, 5]];
  for (const [status, expected] of cases) {
    const errors: string[] = [];
    const code = await runCli(['auth', 'whoami'], dependencies({
      environment: {
        KOOYAHQ_BASE_URL: 'https://example.com',
        KOOYAHQ_ACCESS_KEY_ID: 'access-id',
        KOOYAHQ_SECRET_ACCESS_KEY: 'top-secret',
      },
      fetch: async () => new Response(JSON.stringify({ message: `status ${status}` }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
      output: { stdout: () => undefined, stderr: (value) => errors.push(value) },
    }));
    assert.equal(code, expected);
    assert.doesNotMatch(errors.join('\n'), /top-secret|access-id/);
  }
});

test('refuses to guess a timer when the eligible list is ambiguous', async () => {
  const requests: string[] = [];
  const code = await runCli(['time', 'timers', 'pause'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ data: [{ id: 't1' }, { id: 't2' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  }));
  assert.equal(code, 2);
  assert.equal(requests.length, 1);
  assert.match(requests[0]!, /\/time\/timers\?status=running$/);
});

test('uses the only eligible timer when no timer id is supplied', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const code = await runCli(['time', 'timers', 'resume'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET' });
      return requests.length === 1
        ? new Response(JSON.stringify({ data: [{ id: 'timer 1' }] }), {
          status: 200, headers: { 'content-type': 'application/json' },
        })
        : new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  }));
  assert.equal(code, 0);
  assert.deepEqual(requests, [
    { url: 'https://example.com/api/cli/v1/time/timers?status=paused', method: 'GET' },
    { url: 'https://example.com/api/cli/v1/time/timers/timer%201/resume', method: 'POST' },
  ]);
});

test('failed configure validation does not overwrite stored credentials', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'kooyahq-runtime-'));
  const configPath = join(homeDirectory, '.kooyahq', 'config.json');
  await writeConfig(configPath, {
    baseUrl: 'https://old.example.com',
    accessKeyId: 'old-id',
    secretAccessKey: 'old-secret',
  }, 'linux');
  const before = await readFile(configPath, 'utf8');
  const answers = ['https://example.com', 'new-id', 'new-secret'];
  const code = await runCli(['configure'], dependencies({
    homeDirectory,
    prompt: async () => answers.shift()!,
    fetch: async () => new Response(JSON.stringify({ message: 'invalid' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    }),
  }));
  assert.equal(code, 3);
  assert.equal(await readFile(configPath, 'utf8'), before);
});

test('configure show redacts the secret', async () => {
  const lines: string[] = [];
  const code = await runCli(['configure', 'show'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'access-id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'hidden-secret',
    },
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /\[REDACTED\]/);
  assert.doesNotMatch(lines.join('\n'), /hidden-secret/);
});

test('required create options fail before network traffic', async () => {
  let calls = 0;
  const code = await runCli(['tickets', 'create', '--title', 'Incomplete'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  }));
  assert.equal(code, 2);
  assert.equal(calls, 0);
});

test('prints a success message for empty successful mutation responses', async () => {
  const lines: string[] = [];
  const code = await runCli(['projects', 'delete', '507f1f77bcf86cd799439010', '--yes'], dependencies({
    environment: {
      KOOYAHQ_BASE_URL: 'https://example.com',
      KOOYAHQ_ACCESS_KEY_ID: 'id',
      KOOYAHQ_SECRET_ACCESS_KEY: 'secret',
    },
    fetch: async () => new Response(null, { status: 204 }),
    output: { stdout: (value) => lines.push(value), stderr: () => undefined },
  }));

  assert.equal(code, 0);
  assert.deepEqual(lines, ['Success.']);
});
