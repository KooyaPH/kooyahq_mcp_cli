import assert from 'node:assert/strict';
import test from 'node:test';

import { commandCatalog, commandNames } from '../src/commands/catalog.js';
import { buildRequest } from '../src/commands/request.js';

const EXPECTED_COMMANDS = [
  'analytics costs', 'analytics costs budgets comparisons', 'analytics costs budgets create',
  'analytics costs budgets delete', 'analytics costs budgets list', 'analytics costs budgets update',
  'analytics costs compare', 'analytics costs forecast', 'analytics costs live',
  'analytics costs projects get', 'analytics costs projects list',
  'analytics projects', 'analytics team', 'analytics time',
  'auth whoami',
  'boards activities list', 'boards assignees list', 'boards mentions list',
  'boards automation add', 'boards automation list', 'boards automation remove', 'boards automation update',
  'boards columns add', 'boards columns list', 'boards columns move', 'boards columns remove', 'boards columns update',
  'boards create', 'boards delete', 'boards favorite', 'boards favorite set', 'boards favorite toggle',
  'boards get', 'boards list',
  'boards members add', 'boards members list', 'boards members remove', 'boards members update-role',
  'boards settings fields list', 'boards settings fields reset', 'boards settings fields set',
  'boards settings get', 'boards settings update', 'boards update',
  'notifications count', 'notifications list', 'notifications mark-all-read', 'notifications mark-read',
  'projects create', 'projects delete', 'projects get', 'projects keyword-migration apply',
  'projects keyword-migration preview', 'projects list', 'projects update',
  'tickets activities list',
  'tickets archive', 'tickets assigned',
  'tickets blockers add', 'tickets blockers list', 'tickets blockers remove',
  'tickets comments create', 'tickets comments delete', 'tickets comments list', 'tickets comments update',
  'tickets create', 'tickets criteria add', 'tickets criteria list', 'tickets criteria remove', 'tickets criteria set',
  'tickets delete', 'tickets detail',
  'tickets development clear', 'tickets development get', 'tickets development set',
  'tickets documents add', 'tickets documents list', 'tickets documents remove',
  'tickets epic clear', 'tickets epic set', 'tickets get', 'tickets import apply', 'tickets import preview',
  'tickets improve', 'tickets improve-draft', 'tickets list', 'tickets move',
  'tickets parent clear', 'tickets parent set',
  'tickets relations add', 'tickets relations list', 'tickets relations remove',
  'tickets search', 'tickets subtasks list', 'tickets unarchive', 'tickets update', 'tickets viewers list',
  'time entries create', 'time entries delete', 'time entries get', 'time entries list', 'time entries today', 'time entries update',
  'time timers add-task', 'time timers list', 'time timers pause', 'time timers resume',
  'time timers start', 'time timers start-many', 'time timers stop', 'time timers stop-all',
  'time workday end', 'time workday status', 'time workday summary',
  'users activity list', 'users clients create', 'users create', 'users delete', 'users export',
  'users get', 'users list', 'users permissions get',
  'users permissions update', 'users stats', 'users templates get', 'users templates list', 'users update',
].sort();

test('catalog exposes the exact required command surface', () => {
  assert.deepEqual(commandNames(commandCatalog).sort(), EXPECTED_COMMANDS);
});

test('maps CRUD path parameters and safely encodes path segments', () => {
  assert.deepEqual(buildRequest(commandCatalog, ['projects', 'get', 'project / one']), {
    method: 'GET',
    path: '/projects/project%20%2F%20one',
    query: {},
    output: 'table',
    warnings: ['Positional <id> is deprecated; use --project-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'members', 'update-role', 'board-1', 'user@example.com', '--role', 'admin',
  ]), {
    method: 'PATCH',
    path: '/boards/board-1/members',
    query: {},
    body: { userId: 'user@example.com', role: 'admin' },
    output: 'table',
    warnings: [
      'Positional <boardId> is deprecated; use --board-id.',
      'Positional <userId> is deprecated; use --user-id.',
    ],
  });
});

test('uses explicit board selectors and preserves the positional id as a deprecated alias', () => {
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'get', '--board-id', 'board / one']), {
    method: 'GET',
    path: '/boards/board%20%2F%20one',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'get', '--board-key', 'OPS']), {
    method: 'GET',
    path: '/boards/key/OPS',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'get', 'board-1']), {
    method: 'GET',
    path: '/boards/board-1',
    query: {},
    output: 'table',
    warnings: ['Positional <id> is deprecated; use --board-id.'],
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'get', '--board-id', 'board-1', '--board-key', 'OPS']),
    /exactly one of --board-id or --board-key/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'get']),
    /exactly one of --board-id or --board-key/,
  );
});

test('requires an exact board id or key for board-scoped ticket lists and creates', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'list', '--board-key', 'OPS', '--ticket-type', 'bug',
  ]), {
    method: 'GET',
    path: '/tickets',
    query: { boardKey: 'OPS', ticketType: 'bug' },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'create', '--board-key', 'OPS', '--ticket-type', 'task', '--title', 'Release',
  ]), {
    method: 'POST',
    path: '/tickets',
    query: {},
    body: { boardKey: 'OPS', ticketType: 'task', title: 'Release' },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'create', '--board-id', 'board-1', '--board-key', 'OPS',
      '--ticket-type', 'task', '--title', 'Release',
    ]),
    /exactly one of --board-id or --board-key/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'list']),
    /exactly one of --board-id or --board-key/,
  );
});

test('uses explicit resource selectors across projects, tickets, time, users, and comments', () => {
  assert.equal(
    buildRequest(commandCatalog, ['projects', 'get', '--project-id', 'project / 1']).path,
    '/projects/project%20%2F%201',
  );
  assert.equal(
    buildRequest(commandCatalog, ['tickets', 'get', '--ticket-key', 'OPS-42']).path,
    '/tickets/key/OPS-42',
  );
  assert.equal(
    buildRequest(commandCatalog, ['time', 'entries', 'get', '--entry-id', 'entry / 1']).path,
    '/time/entries/entry%20%2F%201',
  );
  assert.equal(
    buildRequest(commandCatalog, ['time', 'timers', 'pause', '--timer-id', 'timer / 1']).path,
    '/time/timers/timer%20%2F%201/pause',
  );
  assert.equal(
    buildRequest(commandCatalog, ['users', 'get', '--user-id', 'user / 1']).path,
    '/users/user%20%2F%201',
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'comments', 'create', '--ticket-key', 'OPS-42', '--content', 'Ready',
  ]).body, { content: 'Ready' });
});

test('aligns favorite and member mutations with the backend body contract', () => {
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'favorite', 'board-1']), {
    method: 'POST', path: '/boards/board-1/favorite', query: {}, output: 'table',
    warnings: ['Positional <id> is deprecated; use --board-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'members', 'remove', 'board-1', 'user-1', '--yes',
  ]), {
    method: 'DELETE', path: '/boards/board-1/members', query: {}, body: { userId: 'user-1' }, output: 'table',
    warnings: [
      'Positional <boardId> is deprecated; use --board-id.',
      'Positional <userId> is deprecated; use --user-id.',
    ],
  });
});

test('allowlists and URL-encodes list filters, sort, and pagination', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'list', '--page', '2', '--limit', '50', '--sort', 'createdAt', '--order', 'desc',
    '--search', 'red & blue', '--board-id', 'board 1', '--column-id', 'in progress', '--output', 'json',
  ]), {
    method: 'GET',
    path: '/tickets',
    query: {
      page: 2, limit: 50, sortBy: 'createdAt', sortOrder: 'desc', search: 'red & blue',
      boardId: 'board 1', columnId: 'in progress',
    },
    output: 'json',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'list', '--secret-access-key', 'leak']),
    /Unknown option/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['projects', 'list', '--sort', 'secretAccessKey']),
    /--sort must be/,
  );
});

test('maps backend-specific whoami, timer, ticket, comment, and analytics contracts', () => {
  assert.equal(buildRequest(commandCatalog, ['auth', 'whoami']).path, '/whoami');
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'timers', 'start', '--project', 'project-1', '--task', 'Review',
  ]), {
    method: 'POST', path: '/time/timers', query: {},
    body: { projects: ['project-1'], task: 'Review' }, output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'timers', 'add-task', 'timer-1', '--task', 'Ship release',
  ]), {
    method: 'POST', path: '/time/timers/timer-1/tasks', query: {}, body: { task: 'Ship release' }, output: 'table',
    warnings: ['Positional <id> is deprecated; use --timer-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'update', 'ticket-1', '--column-id', 'column-2',
  ]), {
    method: 'PATCH', path: '/tickets/ticket-1', query: {}, body: { columnId: 'column-2' }, output: 'table',
    warnings: ['Positional <id> is deprecated; use --ticket-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'comments', 'create', 'ticket-1', '--content', 'Ready',
  ]), {
    method: 'POST', path: '/tickets/ticket-1/comments', query: {}, body: { content: 'Ready' }, output: 'table',
    warnings: ['Positional <ticketId> is deprecated; use --ticket-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'analytics', 'time', '--start-date', '2026-07-01', '--end-date', '2026-07-31',
  ]), {
    method: 'GET', path: '/analytics/time',
    query: { startDate: '2026-07-01', endDate: '2026-07-31' }, output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['analytics', 'team', '--start-date', '2026-07-01']),
    /requires --end-date/,
  );
});

test('maps only live KooyaHQ project fields', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'projects', 'create', '--name', 'Launch', '--emoji', '🚀', '--icon-url', 'https://example.com/icon.png',
  ]), {
    method: 'POST', path: '/projects', query: {},
    body: { name: 'Launch', emoji: '🚀', iconUrl: 'https://example.com/icon.png' }, output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['projects', 'update', 'project-1', '--status', 'active']),
    /Unknown option --status/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['projects', 'create', '--emoji', '🚀']),
    /requires --name/,
  );
});

test('enforces and maps the board create/update contracts', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'create', '--name', 'Delivery', '--type', 'kanban', '--description', 'Work',
    '--prefix', 'DEL', '--emoji', '📦', '--columns-json', '[{"name":"Ready"}]',
    '--settings-json', '{"defaultView":"board"}',
  ]), {
    method: 'POST', path: '/boards', query: {},
    body: {
      name: 'Delivery', type: 'kanban', description: 'Work', prefix: 'DEL', emoji: '📦',
      columns: [{ name: 'Ready' }], settings: { defaultView: 'board' },
    },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'create', '--name', 'Missing type']),
    /requires --type/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'update', 'board-1', '--type', 'kanban']),
    /Unknown option --type/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'update', 'board-1', '--default-view', 'list', '--show-swimlanes', 'true',
  ]).body, { defaultView: 'list', showSwimlanes: true });
});

test('maps board workflow commands with explicit selectors and semantic mutations', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'activities', 'list', '--board-key', 'OPS', '--page', '2',
  ]), {
    method: 'GET',
    path: '/boards/key/OPS/activities',
    query: { page: 2 },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'columns', 'add', '--board-id', 'board-1', '--name', 'Review',
    '--color', '#2563eb', '--wip-limit', '4', '--done', 'false',
  ]), {
    method: 'POST',
    path: '/boards/board-1/columns',
    query: {},
    body: { name: 'Review', color: '#2563eb', wipLimit: 4, isDone: false },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'columns', 'move', '--board-id', 'board-1', '--column-id', 'column-2',
    '--before-column-id', 'column-1',
  ]), {
    method: 'PATCH',
    path: '/boards/board-1/columns/column-2/move',
    query: {},
    body: { beforeColumnId: 'column-1' },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'boards', 'columns', 'move', '--board-id', 'board-1', '--column-id', 'column-2',
      '--first', '--last',
    ]),
    /exactly one of/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'columns', 'remove', '--board-id', 'board-1', '--column-id', 'column-2',
    '--move-tickets-to', 'column-1', '--yes',
  ]), {
    method: 'DELETE',
    path: '/boards/board-1/columns/column-2',
    query: {},
    body: { moveTicketsToColumnId: 'column-1' },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'fields', 'set', '--board-id', 'board-1',
    '--field', 'priority', '--visible', 'false', '--order', '2',
  ]).body, { field: 'priority', visible: false, order: 2 });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'automation', 'add', '--board-id', 'board-1', '--status', 'deployed',
    '--target-branch', 'main', '--column-id', 'done', '--enabled', 'true',
  ]).body, {
    status: 'deployed', targetBranch: 'main', columnId: 'done', enabled: true,
  });
});

test('enforces and maps ticket JSON, array, and required fields', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'create', '--board-id', 'board-1', '--ticket-type', 'task', '--title', 'Ship',
    '--description-json', '{"type":"doc"}', '--acceptance-criteria-json', '[{"text":"Verified"}]',
    '--tags', 'release, urgent', '--points', '3',
  ]), {
    method: 'POST', path: '/tickets', query: {},
    body: {
      boardId: 'board-1', ticketType: 'task', title: 'Ship', description: { type: 'doc' },
      acceptanceCriteria: [{ text: 'Verified' }], tags: ['release', 'urgent'], points: 3,
    },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'create', '--board-id', 'board-1', '--title', 'Missing']),
    /requires --ticket-type/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'create', '--board-id', 'b', '--ticket-type', 'task', '--title', 'x', '--description-json', 'not-json']),
    /valid JSON object/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'create', '--board-id', 'b', '--ticket-type', 'task', '--title', 'x', '--acceptance-criteria-json', '{"text":"wrong shape"}']),
    /valid JSON array/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'update', 't1', '--board-id', 'b2']),
    /Unknown option --board-id/,
  );
});

test('uses explicit clear flags and rejects conflicting set-and-clear options', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'update', '--ticket-id', 'ticket-1',
    '--clear-assignee', '--clear-due-date',
  ]).body, { assigneeId: null, dueDate: null });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'update', '--ticket-id', 'ticket-1',
      '--assignee-id', 'user-1', '--clear-assignee',
    ]),
    /at most one of --assignee-id or --clear-assignee/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'update', '--board-id', 'board-1', '--clear-description',
  ]).body, { description: null });
});

test('maps ticket lifecycle, hierarchy, link, and development workflow commands', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'detail', '--ticket-key', 'OPS-42',
  ]), {
    method: 'GET',
    path: '/tickets/key/OPS-42/detail',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'move', '--ticket-id', 'ticket-1', '--column-id', 'column-2',
    '--after-ticket-id', 'ticket-9',
  ]), {
    method: 'PATCH',
    path: '/tickets/ticket-1/move',
    query: {},
    body: { columnId: 'column-2', afterTicketId: 'ticket-9' },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'parent', 'set', '--ticket-id', 'ticket-1', '--parent-ticket-key', 'OPS-1',
  ]).body, { parentTicketKey: 'OPS-1' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'criteria', 'set', '--ticket-id', 'ticket-1',
    '--criterion-id', 'criterion-1', '--completed', 'true',
  ]).body, { completed: true });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'documents', 'add', '--ticket-id', 'ticket-1', '--type', 'figma',
    '--url', 'https://www.figma.com/design/abc', '--title', 'Design',
  ]).body, { type: 'figma', url: 'https://www.figma.com/design/abc', title: 'Design' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'blockers', 'add', '--ticket-id', 'ticket-1', '--blocker-ticket-key', 'OPS-2',
  ]).body, { blockerTicketKey: 'OPS-2' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'development', 'set', '--ticket-id', 'ticket-1',
    '--branch', 'feature/release', '--status', 'pull-requested',
    '--pull-request-url', 'https://github.com/KooyaPH/repo/pull/1',
  ]).body, {
    branch: 'feature/release',
    status: 'pull-requested',
    pullRequestUrl: 'https://github.com/KooyaPH/repo/pull/1',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'relations', 'add', '--ticket-id', 'ticket-1',
      '--related-ticket-id', 'ticket-2', '--related-ticket-key', 'OPS-2',
    ]),
    /exactly one of --related-ticket-id or --related-ticket-key/,
  );
});

test('rejects unsafe URLs, invalid ranges, and oversized timer batches locally', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'documents', 'add', '--ticket-id', 'ticket-1',
      '--type', 'other', '--url', 'http://example.com/reference',
    ]),
    /HTTPS URL/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'time', '--start-date', '2026-02-30', '--end-date', '2026-03-01',
    ]),
    /valid YYYY-MM-DD/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'time', '--start-date', '2025-01-01', '--end-date', '2026-07-01',
    ]),
    /must not exceed 366 days/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'timers', 'start-many', '--projects',
      Array.from({ length: 21 }, (_, index) => `project-${index + 1}`).join(','),
    ]),
    /at most 20 values/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'timers', 'start-many', '--projects', 'project-1,project-1',
    ]),
    /must not contain duplicates/,
  );
});

test('maps self mutations and permission-gated team time reads', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'timers', 'start', '--project', 'project-1', '--task', 'Review', '--is-overtime', 'true',
  ]), {
    method: 'POST', path: '/time/timers', query: {},
    body: { projects: ['project-1'], task: 'Review', isOvertime: true }, output: 'table',
  });
  assert.throws(() => buildRequest(commandCatalog, ['time', 'timers', 'start', '--task', 'Missing']), /requires --project/);
  assert.throws(() => buildRequest(commandCatalog, ['time', 'timers', 'list', '--status', 'finished']), /running or paused/);
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'create', '--projects', 'p1,p2', '--task', 'Delivery', '--duration', '60',
    '--start-time', '2026-07-24T00:00:00Z', '--is-overtime', 'false',
  ]).body, {
    projects: ['p1', 'p2'], task: 'Delivery', duration: 60,
    startTime: '2026-07-24T00:00:00Z', isOvertime: false,
  });
  assert.throws(() => buildRequest(commandCatalog, [
    'time', 'entries', 'create', '--projects', 'p1', '--task', 'Delivery',
  ]), /requires --duration/);
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'list', '--scope', 'team', '--user-id', 'u1',
    '--start-date', '2026-07-01', '--end-date', '2026-07-31',
  ]).query, {
    scope: 'team', userId: 'u1', startDate: '2026-07-01', endDate: '2026-07-31',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'update', 'entry-1', '--user-id', 'u1',
    ]),
    /Unknown option --user-id/,
  );
});

test('allows a time user filter only for an explicit team scope', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'list', '--scope', 'team', '--user-id', 'user-1',
  ]).query, { scope: 'team', userId: 'user-1' });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'list', '--scope', 'me', '--user-id', 'user-1',
    ]),
    /--user-id requires --scope team/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'today', '--user-id', 'user-1']),
    /--user-id requires --scope team/,
  );
});

test('validates exact keys, email addresses, and optional date pairs locally', () => {
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'get', '--board-key', 'OPS-TOO-LONG']),
    /--board-key must be an alphanumeric board key of at most 10 characters/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'get', '--ticket-key', 'OPS']),
    /--ticket-key must look like BOARD-123/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'users', 'clients', 'create', '--name', 'Client', '--email', 'not-an-email',
    ]),
    /--email must be a valid email address/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'users', 'activity', 'list', '--start-date', '2026-07-01',
    ]),
    /requires --end-date when --start-date is supplied/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'costs', 'projects', 'get', '--project', 'Kooya',
      '--end-date', '2026-07-25',
    ]),
    /requires --start-date when --end-date is supplied/,
  );
});

test('maps multiple timer, workday, and notification actions', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'timers', 'start-many', '--projects', 'project-1,project-2',
    '--task', 'Release', '--is-overtime', 'false',
  ]), {
    method: 'POST',
    path: '/time/timers/start-many',
    query: {},
    body: { projects: ['project-1', 'project-2'], task: 'Release', isOvertime: false },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, ['time', 'workday', 'status']), {
    method: 'GET', path: '/time/workday/status', query: {}, output: 'table',
  });
  assert.equal(
    buildRequest(commandCatalog, ['time', 'workday', 'end']).confirmation,
    'End the current workday and stop all active timers?',
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'notifications', 'mark-read', '--notification-id', 'notification / 1',
  ]), {
    method: 'PATCH',
    path: '/notifications/notification%20%2F%201/read',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'notifications', 'mark-all-read',
  ]), {
    method: 'PATCH', path: '/notifications/read-all', query: {}, output: 'table',
  });
});

test('maps user and notification fields to the live API', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'create', '--name', 'Sam', '--email', 'sam@example.com', '--position', 'Developer',
    '--permissions', 'projects:view,board:update', '--bio', 'Builder',
  ]).body, {
    name: 'Sam', email: 'sam@example.com', position: 'Developer',
    permissions: ['projects:view', 'board:update'], bio: 'Builder',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'list', '--search', 'sam', '--include-disabled', 'true', '--sort', 'name', '--order', 'asc',
  ]).query, { search: 'sam', includeDisabled: true, sortBy: 'name', sortOrder: 'asc' });
  assert.throws(() => buildRequest(commandCatalog, ['users', 'create', '--role', 'admin']), /Unknown option --role/);
  assert.throws(() => buildRequest(commandCatalog, ['users', 'create', '--name', 'Missing email']), /requires --email/);
  assert.throws(() => buildRequest(commandCatalog, ['users', 'create', '--email', 'missing@example.com']), /requires --name/);
  assert.deepEqual(buildRequest(commandCatalog, ['notifications', 'list', '--unread-only', 'true']).query, { unreadOnly: true });
  assert.throws(() => buildRequest(commandCatalog, ['notifications', 'count', '--type', 'ticket']), /Unknown option --type/);
});

test('maps remaining frontend project and user management actions', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'projects', 'keyword-migration', 'preview', '--source-projects', 'Kooya,Other',
  ]), {
    method: 'POST', path: '/projects/keyword-migration/preview', query: {},
    body: { sourceProjects: ['Kooya', 'Other'] }, output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'projects', 'keyword-migration', 'apply', '--source-projects', 'Kooya', '--yes',
  ]).body, { sourceProjects: ['Kooya'] });
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'clients', 'create', '--name', 'Client', '--email', 'client@example.com',
    '--client-company-id', 'company-1',
  ]).body, { name: 'Client', email: 'client@example.com', clientCompanyId: 'company-1' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'activity', 'list', '--action', 'user.updated',
    '--start-date', '2026-07-01', '--end-date', '2026-07-25', '--limit', '50',
  ]).query, {
    action: 'user.updated', startDate: '2026-07-01', endDate: '2026-07-25', limit: 50,
  });
  assert.equal(
    buildRequest(commandCatalog, ['users', 'export', '--format', 'csv', '--output', 'raw']).output,
    'raw',
  );
});

test('maps frontend cost analytics reads and budget management actions', () => {
  assert.equal(buildRequest(commandCatalog, ['analytics', 'costs', 'live']).path, '/analytics/costs/live');
  assert.deepEqual(buildRequest(commandCatalog, [
    'analytics', 'costs', 'projects', 'get', '--project', 'Kooya',
    '--start-date', '2026-07-01', '--end-date', '2026-07-25',
  ]), {
    method: 'GET', path: '/analytics/costs/projects/Kooya',
    query: { startDate: '2026-07-01', endDate: '2026-07-25' }, output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'analytics', 'costs', 'budgets', 'create', '--project', 'Kooya',
    '--start-date', '2026-08-01', '--end-date', '2026-08-31', '--amount', '10000',
    '--currency', 'PHP', '--alert-thresholds-json', '{"warning":75,"critical":90}',
  ]).body, {
    project: 'Kooya', startDate: '2026-08-01', endDate: '2026-08-31', amount: 10000,
    currency: 'PHP', alertThresholds: { warning: 75, critical: 90 },
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'costs', 'compare', '--current-start', '2026-07-01',
    ]),
    /requires --current-end/,
  );
});

test('requires board member identity and role locally', () => {
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'add', 'board-1', '--user-id', 'user-1']),
    /requires --role/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'add', 'board-1', '--role', 'admin']),
    /requires --user-id/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'update-role', 'board-1', 'user-1']),
    /requires --role/,
  );
});

test('limits time entry update to projects, task, and duration', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'update', 'entry-1', '--projects', 'p1,p2', '--task', 'Review', '--duration', '30',
  ]).body, { projects: ['p1', 'p2'], task: 'Review', duration: 30 });
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'update', 'entry-1', '--start-time', '2026-07-24T00:00:00Z']),
    /Unknown option --start-time/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'update', 'entry-1', '--is-overtime', 'true']),
    /Unknown option --is-overtime/,
  );
});

test('requires confirmation for destructive bulk or delete operations', () => {
  assert.equal(
    buildRequest(commandCatalog, ['projects', 'delete', 'p1']).confirmation,
    'Delete project p1?',
  );
  assert.equal(
    buildRequest(commandCatalog, ['time', 'timers', 'stop-all', '--yes']).confirmation,
    undefined,
  );
});
