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
  'announcements create', 'announcements delete', 'announcements get', 'announcements list', 'announcements update',
  'auth whoami',
  'boards activities list', 'boards assignees list', 'boards mentions list',
  'boards automation add', 'boards automation list', 'boards automation remove', 'boards automation update',
  'boards columns add', 'boards columns list', 'boards columns move', 'boards columns remove', 'boards columns update',
  'boards create', 'boards delete', 'boards favorite', 'boards favorite set', 'boards favorite toggle',
  'boards get', 'boards list',
  'boards members add', 'boards members list', 'boards members remove', 'boards members update-role',
  'boards settings fields list', 'boards settings fields reset', 'boards settings fields set',
  'boards settings get', 'boards settings update', 'boards update',
  'chat contacts list',
  'chat conversations archive', 'chat conversations create-direct', 'chat conversations create-group',
  'chat conversations delete', 'chat conversations get', 'chat conversations leave', 'chat conversations list',
  'chat conversations members add', 'chat conversations members remove', 'chat conversations read',
  'chat conversations unarchive', 'chat conversations unread', 'chat conversations update',
  'chat messages delete', 'chat messages list', 'chat messages send', 'chat messages update',
  'documentation create-file', 'documentation create-link', 'documentation delete', 'documentation list',
  'documentation pin', 'documentation unpin', 'documentation update',
  'kooyapedia home', 'kooyapedia pages get', 'kooyapedia pages list',
  'kooyapedia search', 'kooyapedia suggest',
  'meet contacts list', 'meet egress active', 'meet egress start', 'meet egress status', 'meet egress stop',
  'meet recordings analysis', 'meet recordings get', 'meet recordings list', 'meet recordings upload',
  'meet token create',
  'notifications count', 'notifications list', 'notifications mark-all-read', 'notifications mark-read',
  'posts comments create', 'posts comments delete', 'posts comments list', 'posts comments update',
  'posts create', 'posts delete', 'posts list', 'posts list-mine', 'posts poll vote',
  'posts reactions add', 'posts reactions list', 'posts reactions remove', 'posts update',
  'presence locations list',
  'projects create', 'projects delete', 'projects get', 'projects keyword-migration apply',
  'projects keyword-migration preview', 'projects list', 'projects update',
  'settings preferences get', 'settings preferences set', 'settings profile get', 'settings profile update',
  'settings theme get', 'settings theme mandatory set', 'settings theme set',
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
  assert.deepEqual(buildRequest(commandCatalog, ['projects', 'get', '507f1f77bcf86cd799439010']), {
    method: 'GET',
    path: '/projects/507f1f77bcf86cd799439010',
    query: {},
    output: 'table',
    warnings: ['Positional <id> is deprecated; use --project-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'members', 'update-role', '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439015', '--role', 'admin',
  ]), {
    method: 'PATCH',
    path: '/boards/507f1f77bcf86cd799439011/members',
    query: {},
    body: { userId: '507f1f77bcf86cd799439015', role: 'admin' },
    output: 'table',
    warnings: [
      'Positional <boardId> is deprecated; use --board-id.',
      'Positional <userId> is deprecated; use --user-id.',
    ],
  });
});

test('uses explicit board selectors and preserves the positional id as a deprecated alias', () => {
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'get', '--board-id', '507f1f77bcf86cd799439011']), {
    method: 'GET',
    path: '/boards/507f1f77bcf86cd799439011',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'get', '--board-key', 'OPS']), {
    method: 'GET',
    path: '/boards/key/OPS',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'get', '507f1f77bcf86cd799439011']), {
    method: 'GET',
    path: '/boards/507f1f77bcf86cd799439011',
    query: {},
    output: 'table',
    warnings: ['Positional <id> is deprecated; use --board-id.'],
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'get', '--board-id', '507f1f77bcf86cd799439011', '--board-key', 'OPS']),
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
      'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--board-key', 'OPS',
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
    buildRequest(commandCatalog, ['projects', 'get', '--project-id', '507f1f77bcf86cd799439010']).path,
    '/projects/507f1f77bcf86cd799439010',
  );
  assert.equal(
    buildRequest(commandCatalog, ['tickets', 'get', '--ticket-key', 'OPS-42']).path,
    '/tickets/key/OPS-42',
  );
  assert.equal(
    buildRequest(commandCatalog, ['time', 'entries', 'get', '--entry-id', '507f1f77bcf86cd799439014']).path,
    '/time/entries/507f1f77bcf86cd799439014',
  );
  assert.equal(
    buildRequest(commandCatalog, ['time', 'timers', 'pause', '--timer-id', '507f1f77bcf86cd799439013']).path,
    '/time/timers/507f1f77bcf86cd799439013/pause',
  );
  assert.equal(
    buildRequest(commandCatalog, ['users', 'get', '--user-id', '507f1f77bcf86cd799439015']).path,
    '/users/507f1f77bcf86cd799439015',
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'comments', 'create', '--ticket-key', 'OPS-42', '--content', 'Ready',
  ]).body, { content: 'Ready' });
});

test('aligns favorite and member mutations with the backend body contract', () => {
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'favorite', '507f1f77bcf86cd799439011']), {
    method: 'POST', path: '/boards/507f1f77bcf86cd799439011/favorite', query: {}, output: 'table',
    warnings: ['Positional <id> is deprecated; use --board-id.'],
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'members', 'remove', '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439015', '--yes',
  ]), {
    method: 'DELETE', path: '/boards/507f1f77bcf86cd799439011/members', query: {}, body: { userId: '507f1f77bcf86cd799439015' }, output: 'table',
    warnings: [
      'Positional <boardId> is deprecated; use --board-id.',
      'Positional <userId> is deprecated; use --user-id.',
    ],
  });
});

test('allowlists and URL-encodes list filters, sort, and pagination', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'list', '--page', '2', '--limit', '50', '--sort', 'createdAt', '--order', 'desc',
    '--search', 'red & blue', '--board-id', '507f1f77bcf86cd799439011', '--column-id', 'in progress', '--output', 'json',
  ]), {
    method: 'GET',
    path: '/tickets',
    query: {
      page: 2, limit: 50, sortBy: 'createdAt', sortOrder: 'desc', search: 'red & blue',
      boardId: '507f1f77bcf86cd799439011', columnId: 'in progress',
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

test('preserves every equals sign in an inline option value', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'search', '--query=alpha=beta=gamma', '--board-id=507f1f77bcf86cd799439011',
  ]).query, {
    q: 'alpha=beta=gamma',
    boardId: '507f1f77bcf86cd799439011',
  });
});

test('rejects repeated non-repeatable options', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'boards', 'delete', '--board-id=first', '--board-id=second', '--yes',
    ]),
    /Option --board-id must not be repeated/,
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
    'time', 'timers', 'add-task', '507f1f77bcf86cd799439013', '--task', 'Ship release',
  ]), {
    method: 'POST', path: '/time/timers/507f1f77bcf86cd799439013/tasks', query: {}, body: { task: 'Ship release' }, output: 'table',
    warnings: ['Positional <id> is deprecated; use --timer-id.'],
  });
  assert.throws(() => buildRequest(commandCatalog, [
    'tickets', 'update', '507f1f77bcf86cd799439012', '--column-id', 'column-2',
  ]), /Unknown option --column-id/);
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'comments', 'create', '507f1f77bcf86cd799439012', '--content', 'Ready',
  ]), {
    method: 'POST', path: '/tickets/507f1f77bcf86cd799439012/comments', query: {}, body: { content: 'Ready' }, output: 'table',
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
  assert.deepEqual(buildRequest(commandCatalog, [
    'analytics', 'time', '--start-date', '2026-07-01', '--end-date', '2026-07-31',
    '--user-id', '507f1f77bcf86cd799439015',
  ]).query, {
    startDate: '2026-07-01', endDate: '2026-07-31', userId: '507f1f77bcf86cd799439015',
  });
  assert.throws(() => buildRequest(commandCatalog, [
    'analytics', 'team', '--start-date', '2026-07-01', '--end-date', '2026-07-31',
    '--user-id', '507f1f77bcf86cd799439015',
  ]), /Unknown option --user-id/);
  assert.deepEqual(buildRequest(commandCatalog, ['analytics', 'costs']).query, {});
  assert.throws(
    () => buildRequest(commandCatalog, ['analytics', 'costs', '--start-date', '2026-07-01']),
    /requires --end-date/,
  );
});

test('exposes backend-supported search on paginated time reads', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'timers', 'list', '--search', 'Kooya',
  ]).query, { search: 'Kooya' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'list', '--search', 'release',
  ]).query, { search: 'release' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'today', '--search', 'review',
  ]).query, { search: 'review' });
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
    '--prefix', 'DEL', '--emoji', '📦',
    '--columns-json', '[{"id":"ready","name":"Ready","order":0,"isDoneColumn":false}]',
    '--settings-json', '{"defaultView":"board"}',
  ]), {
    method: 'POST', path: '/boards', query: {},
    body: {
      name: 'Delivery', type: 'kanban', description: 'Work', prefix: 'DEL', emoji: '📦',
      columns: [{ id: 'ready', name: 'Ready', order: 0, isDoneColumn: false }],
      settings: { defaultView: 'board' },
    },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'create', '--name', 'Missing type']),
    /requires --type/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'update', '507f1f77bcf86cd799439011', '--type', 'kanban']),
    /Unknown option --type/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'update', '507f1f77bcf86cd799439011', '--default-view', 'list', '--show-swimlanes', 'true',
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
    'boards', 'columns', 'add', '--board-id', '507f1f77bcf86cd799439011', '--name', 'Review',
    '--color', '#2563eb', '--wip-limit', '4', '--done', 'false',
  ]), {
    method: 'POST',
    path: '/boards/507f1f77bcf86cd799439011/columns',
    query: {},
    body: { name: 'Review', color: '#2563eb', wipLimit: 4, isDone: false },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'columns', 'move', '--board-id', '507f1f77bcf86cd799439011', '--column-id', 'column-2',
    '--before-column-id', 'column-1',
  ]), {
    method: 'PATCH',
    path: '/boards/507f1f77bcf86cd799439011/columns/column-2/move',
    query: {},
    body: { beforeColumnId: 'column-1' },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'boards', 'columns', 'move', '--board-id', '507f1f77bcf86cd799439011', '--column-id', 'column-2',
      '--first', '--last',
    ]),
    /exactly one of/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'columns', 'remove', '--board-id', '507f1f77bcf86cd799439011', '--column-id', 'column-2',
    '--move-tickets-to', 'column-1', '--yes',
  ]), {
    method: 'DELETE',
    path: '/boards/507f1f77bcf86cd799439011/columns/column-2',
    query: {},
    body: { moveTicketsToColumnId: 'column-1' },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'fields', 'set', '--board-id', '507f1f77bcf86cd799439011',
    '--field', 'priority', '--visible', 'false', '--order', '2',
  ]).body, { field: 'priority', visible: false, order: 2 });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'automation', 'add', '--board-id', '507f1f77bcf86cd799439011', '--status', 'deployed',
    '--target-branch', 'main', '--column-id', 'done', '--enabled', 'true',
  ]).body, {
    status: 'deployed', targetBranch: 'main', columnId: 'done', enabled: true,
  });
});

test('enforces and maps ticket JSON, array, and required fields', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--ticket-type', 'task', '--title', 'Ship',
    '--description-json', '{"type":"html","content":"<p>Ship safely</p>"}', '--acceptance-criteria-json', '[{"text":"Verified"}]',
    '--tags', 'release, urgent', '--points', '3', '--parent-ticket-key', 'OPS-7',
    '--root-epic-id', '507f1f77bcf86cd799439014',
  ]), {
    method: 'POST', path: '/tickets', query: {},
    body: {
      boardId: '507f1f77bcf86cd799439011', ticketType: 'task', title: 'Ship', description: { type: 'html', content: '<p>Ship safely</p>' },
      acceptanceCriteria: [{ text: 'Verified' }], tags: ['release', 'urgent'], points: 3,
      parentTicketKey: 'OPS-7', rootEpicId: '507f1f77bcf86cd799439014',
    },
    output: 'table',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--title', 'Missing']),
    /requires --ticket-type/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--ticket-type', 'task', '--title', 'x', '--description-json', 'not-json']),
    /valid JSON object/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--ticket-type', 'task',
      '--title', 'x', '--description-json', '{"type":"doc","content":[]}',
    ]),
    /schema/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--ticket-type', 'task', '--title', 'x', '--acceptance-criteria-json', '{"text":"wrong shape"}']),
    /valid JSON array/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'update', 't1', '--board-id', 'b2']),
    /Unknown option --board-id/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--ticket-type', 'task',
      '--title', 'Task', '--points', '4',
    ]),
    /--points must be 1, 2, 3, 5, 8, 13/,
  );
});

test('uses explicit clear flags and rejects conflicting set-and-clear options', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'update', '--ticket-id', '507f1f77bcf86cd799439012',
    '--clear-assignee', '--clear-due-date', '--clear-description', '--clear-tags',
  ]).body, {
    assigneeId: null,
    dueDate: null,
    description: { type: 'html', content: '' },
    tags: [],
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'update', '--ticket-id', '507f1f77bcf86cd799439012',
      '--assignee-id', '507f1f77bcf86cd799439015', '--clear-assignee',
    ]),
    /at most one of --assignee-id or --clear-assignee/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'update', '--board-id', '507f1f77bcf86cd799439011', '--clear-description',
  ]).body, { description: '' });

  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'automation', 'update', '--board-id', '507f1f77bcf86cd799439011',
    '--rule-id', 'rule_1', '--clear-target-branch', '--clear-description',
  ]).body, { targetBranch: '', description: '' });

  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'columns', 'update', '--board-id', '507f1f77bcf86cd799439011',
    '--column-id', 'todo', '--clear-color', '--clear-wip-limit',
  ]).body, { color: null, wipLimit: null });
});

test('matches board automation and ticket-detail-field mutation requirements', () => {
  assert.throws(() => buildRequest(commandCatalog, [
    'boards', 'automation', 'add', '--board-key', 'OPS', '--status', 'deployed', '--column-id', 'done',
  ]), /requires --enabled/);
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'automation', 'add', '--board-key', 'OPS', '--enabled', 'true',
    '--status', 'deployed', '--column-id', 'done',
  ]).body, { enabled: true, status: 'deployed', columnId: 'done' });
  assert.throws(() => buildRequest(commandCatalog, [
    'boards', 'settings', 'fields', 'set', '--board-key', 'OPS', '--field', 'priority',
  ]), /at least one of --visible or --order/);
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'settings', 'fields', 'set', '--board-key', 'OPS', '--field', 'priority',
    '--visible', 'false', '--order', '2',
  ]).body, { field: 'priority', visible: false, order: 2 });
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
    'tickets', 'move', '--ticket-id', '507f1f77bcf86cd799439012', '--column-id', 'column-2',
    '--after-ticket-key', 'OPS-9',
  ]), {
    method: 'PATCH',
    path: '/tickets/507f1f77bcf86cd799439012/move',
    query: {},
    body: { columnId: 'column-2', afterTicketKey: 'OPS-9' },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'parent', 'set', '--ticket-id', '507f1f77bcf86cd799439012', '--parent-ticket-key', 'OPS-1',
  ]).body, { parentTicketKey: 'OPS-1' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'criteria', 'set', '--ticket-id', '507f1f77bcf86cd799439012',
    '--criterion-id', 'criterion-1', '--completed', 'true',
  ]).body, { completed: true });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'documents', 'add', '--ticket-id', '507f1f77bcf86cd799439012', '--type', 'figma',
    '--url', 'https://www.figma.com/design/abc', '--name', 'Design',
  ]).body, { type: 'figma', url: 'https://www.figma.com/design/abc', name: 'Design' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'documents', 'remove', '--ticket-key', 'OPS-42',
    '--url', 'https://www.figma.com/design/abc', '--yes',
  ]), {
    method: 'DELETE',
    path: '/tickets/key/OPS-42/documents',
    query: {},
    body: { url: 'https://www.figma.com/design/abc' },
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'blockers', 'add', '--ticket-id', '507f1f77bcf86cd799439012', '--blocker-ticket-key', 'OPS-2',
  ]).body, { blockerTicketKey: 'OPS-2' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'development', 'set', '--ticket-id', '507f1f77bcf86cd799439012',
    '--branch', 'feature/release', '--status', 'pull-requested',
    '--pull-request-url', 'https://github.com/KooyaPH/repo/pull/1',
  ]).body, {
    branchName: 'feature/release',
    status: 'pull-requested',
    pullRequestUrl: 'https://github.com/KooyaPH/repo/pull/1',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'relations', 'add', '--ticket-id', '507f1f77bcf86cd799439012',
      '--related-ticket-id', '507f1f77bcf86cd799439013', '--related-ticket-key', 'OPS-2',
    ]),
    /exactly one of --related-ticket-id or --related-ticket-key/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'improve', '--ticket-key', 'OPS-42', '--user-command', 'Focus on rollback safety',
  ]).body, { userCommand: 'Focus on rollback safety' });
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'improve', '--ticket-id', '507f1f77bcf86cd799439012', '--instructions', 'rewrite']),
    /Unknown option --instructions/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'blockers', 'list', '--ticket-key', 'OPS-42', '--direction', 'blocked-by',
  ]).query, { direction: 'blocked-by' });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'blockers', 'list', '--ticket-key', 'OPS-42', '--direction', 'incoming',
    ]),
    /blocked-by, blocking, all/,
  );
});

test('requires unambiguous hierarchy, move anchor, and document selectors', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011', '--ticket-type', 'subtask', '--title', 'Child',
      '--parent-ticket-id', '507f1f77bcf86cd799439012', '--parent-ticket-key', 'OPS-1',
    ]),
    /at most one of --parent-ticket-id or --parent-ticket-key/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'move', '--ticket-id', '507f1f77bcf86cd799439012', '--column-id', 'column-2',
      '--before-ticket-id', '507f1f77bcf86cd799439013', '--before-ticket-key', 'OPS-2',
    ]),
    /exactly one of/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'documents', 'add', '--ticket-id', '507f1f77bcf86cd799439012',
      '--type', 'doc', '--url', 'https://example.com/spec',
    ]),
    /requires --name/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'documents', 'remove', '--ticket-id', '507f1f77bcf86cd799439012', '--document-id', 'invented',
    ]),
    /Unknown option --document-id/,
  );
});

test('rejects unsafe URLs, invalid ranges, and oversized timer batches locally', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'documents', 'add', '--ticket-id', '507f1f77bcf86cd799439012',
      '--type', 'other', '--url', 'http://example.com/reference', '--name', 'Reference',
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
    /must not exceed 366 inclusive calendar dates/,
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
    'time', 'entries', 'list', '--scope', 'team', '--user-id', '507f1f77bcf86cd799439015',
    '--start-date', '2026-07-01', '--end-date', '2026-07-31',
  ]).query, {
    scope: 'team', userId: '507f1f77bcf86cd799439015', startDate: '2026-07-01', endDate: '2026-07-31',
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'update', '507f1f77bcf86cd799439014', '--user-id', '507f1f77bcf86cd799439015',
    ]),
    /Unknown option --user-id/,
  );
});

test('allows a time user filter only for an explicit team scope', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'list', '--scope', 'team', '--user-id', '507f1f77bcf86cd799439015',
  ]).query, { scope: 'team', userId: '507f1f77bcf86cd799439015' });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'list', '--scope', 'team', '--user-id', 'user-1',
    ]),
    /24-character lowercase hexadecimal ObjectId/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'list', '--scope', 'me', '--user-id', '507f1f77bcf86cd799439015',
    ]),
    /--user-id requires --scope team/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'today', '--user-id', '507f1f77bcf86cd799439015']),
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
    'notifications', 'mark-read', '--notification-id', '507f1f77bcf86cd799439016',
  ]), {
    method: 'PATCH',
    path: '/notifications/507f1f77bcf86cd799439016/read',
    query: {},
    output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'notifications', 'mark-all-read',
  ]), {
    method: 'PATCH', path: '/notifications/read-all', query: {}, output: 'table',
  });
});

test('requires a canonical operation id for retry-safe ticket import apply', () => {
  const operationId = '123e4567-e89b-42d3-a456-426614174000';
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'import', 'apply', '--board-key', 'OPS', '--operation-id', operationId,
    '--stdin', '--format', 'json', '--yes',
  ]), {
    method: 'POST', path: '/tickets/import', query: {},
    body: { boardKey: 'OPS', operationId }, output: 'table',
    fileInput: {
      bodyName: 'rows', maxBytes: 5 * 1024 * 1024, maxItems: 250,
      stdin: true, format: 'json',
    },
  });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'import', 'apply', '--board-key', 'OPS', '--stdin', '--format', 'json',
    ]),
    /requires --operation-id/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'import', 'apply', '--board-key', 'OPS', '--operation-id', operationId.toUpperCase(),
      '--stdin', '--format', 'json',
    ]),
    /lowercase UUID/,
  );
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
    'users', 'list', '--search', 'sam', '--include-disabled', 'true', '--position', 'Developer',
    '--status', 'online', '--created-from', '2026-01-01', '--created-to', '2026-01-31',
    '--sort', 'name', '--order', 'asc',
  ]).query, {
    search: 'sam', includeDisabled: true, position: 'Developer', status: 'online',
    createdFrom: '2026-01-01', createdTo: '2026-01-31', sortBy: 'name', sortOrder: 'asc',
  });
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
  assert.throws(() => buildRequest(commandCatalog, [
    'users', 'clients', 'create', '--name', 'Client', '--email', 'client@example.com',
    '--client-company-id', 'company-1',
  ]), /Unknown option --client-company-id/);
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'activity', 'list', '--action', 'update_user',
    '--search', 'sam@example.com', '--start-date', '2026-07-01', '--end-date', '2026-07-25', '--limit', '50',
  ]).query, {
    action: 'update_user', search: 'sam@example.com',
    startDate: '2026-07-01', endDate: '2026-07-25', limit: 50,
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['users', 'activity', 'list', '--action', 'user.updated']),
    /--action must be/,
  );
  assert.equal(
    buildRequest(commandCatalog, ['users', 'export', '--format', 'csv', '--output', 'raw']).output,
    'raw',
  );
});

test('uses explicit project and user profile clear flags', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'projects', 'update', '--project-id', '507f1f77bcf86cd799439010',
    '--clear-emoji', '--clear-icon-url',
  ]).body, { emoji: '', iconUrl: '' });
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'update', '--user-id', '507f1f77bcf86cd799439015',
    '--clear-position', '--clear-birthday', '--clear-bio',
  ]).body, { position: '', birthday: '', bio: '' });
  assert.throws(() => buildRequest(commandCatalog, [
    'projects', 'update', '--project-id', '507f1f77bcf86cd799439010',
    '--emoji', '🚀', '--clear-emoji',
  ]), /at most one of --emoji or --clear-emoji/);
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
  assert.throws(
    () => buildRequest(commandCatalog, ['analytics', 'costs', 'budgets', 'comparisons', '--limit', '21']),
    /integer from 1 to 20/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'costs', 'forecast', '--start-date', '2026-01-01', '--end-date', '2026-01-31', '--days', '366',
    ]),
    /integer from 1 to 365/,
  );
});

test('requires board member identity and role locally', () => {
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'add', '507f1f77bcf86cd799439011', '--user-id', '507f1f77bcf86cd799439015']),
    /requires --role/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'add', '507f1f77bcf86cd799439011', '--role', 'admin']),
    /requires --user-id/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'update-role', '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439015']),
    /requires --role/,
  );
});

test('limits time entry update to projects, task, and duration', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'time', 'entries', 'update', '507f1f77bcf86cd799439014', '--projects', 'p1,p2', '--task', 'Review', '--duration', '30',
  ]).body, { projects: ['p1', 'p2'], task: 'Review', duration: 30 });
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'update', '507f1f77bcf86cd799439014', '--start-time', '2026-07-24T00:00:00Z']),
    /Unknown option --start-time/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'update', '507f1f77bcf86cd799439014', '--is-overtime', 'true']),
    /Unknown option --is-overtime/,
  );
});

test('requires confirmation for destructive bulk or delete operations', () => {
  assert.equal(
    buildRequest(commandCatalog, ['projects', 'delete', '507f1f77bcf86cd799439010']).confirmation,
    'Delete project 507f1f77bcf86cd799439010?',
  );
  assert.equal(
    buildRequest(commandCatalog, ['time', 'timers', 'stop-all', '--yes']).confirmation,
    undefined,
  );
});

test('applies endpoint-specific sort allowlists and selector validation', () => {
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'list', '--sort', 'duration']),
    /--sort must be/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'members', 'list', '--board-key', 'OPS', '--role', 'owner']),
    /--role must be admin, member, viewer/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'assigned', '--board-id', '507f1f77bcf86cd799439011', '--board-key', 'OPS',
    ]),
    /at most one of --board-id or --board-key/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'assigned', '--board-key', 'OPS!']),
    /alphanumeric board key/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'search', '--query', 'release', '--board-id', '507f1f77bcf86cd799439011', '--board-key', 'OPS',
    ]),
    /at most one of --board-id or --board-key/,
  );
});

test('validates calendar dates, strict timestamps, and every declared range locally', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'list', '--start-date', '2026-02-30', '--end-date', '2026-03-01',
    ]),
    /valid YYYY-MM-DD date/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['time', 'entries', 'list', '--start-date', '2026-07-01']),
    /requires --end-date/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'list', '--start-date', '2026-07-25', '--end-date', '2026-07-01',
    ]),
    /must not be after/,
  );
  assert.doesNotThrow(() => buildRequest(commandCatalog, [
    'time', 'entries', 'list', '--start-date', '2025-01-01', '--end-date', '2026-01-01',
  ]));
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'list', '--start-date', '2025-01-01', '--end-date', '2026-01-02',
    ]),
    /must not exceed 366 inclusive calendar dates/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'create', '--projects', 'Kooya', '--task', 'Review', '--duration', '30',
      '--start-time', '2026-02-30T09:00:00Z', '--end-time', '2026-07-25T10:00:00Z',
    ]),
    /zoned ISO-8601 timestamp/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'time', 'entries', 'create', '--projects', 'Kooya', '--task', 'Review', '--duration', '30',
      '--start-time', '2026-07-25T10:00:00Z', '--end-time', '2026-07-25T09:00:00Z',
    ]),
    /--start-time must not be after --end-time/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'costs', 'compare',
      '--current-start', '2026-08-01', '--current-end', '2026-07-01',
      '--previous-start', '2026-06-01', '--previous-end', '2026-06-30',
    ]),
    /--current-start must not be after --current-end/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'analytics', 'costs', 'compare',
      '--current-start', '2025-01-01', '--current-end', '2026-07-25',
      '--previous-start', '2024-01-01', '--previous-end', '2024-01-31',
    ]),
    /Date range must not exceed 366 inclusive calendar dates/,
  );
});

test('validates endpoint URLs and board keys before sending requests', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'projects', 'create', '--name', 'Kooya', '--icon-url', 'javascript:alert(1)',
    ]),
    /HTTPS URL/,
  );
  for (const command of [
    ['tickets', 'improve-draft', '--board-key', 'OPS!', '--title', 'Draft'],
    ['tickets', 'import', 'preview', '--board-key', 'OPS!', '--stdin'],
  ]) {
    assert.throws(() => buildRequest(commandCatalog, command), /alphanumeric board key/);
  }
});

test('maps user WhatsApp and explicit permission clearing without ambiguous empty values', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'create', '--name', 'Sam', '--email', 'sam@example.com',
    '--whatsapp-phone', '+639171234567',
  ]).body, {
    name: 'Sam', email: 'sam@example.com', whatsappPhone: '+639171234567',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'update', '--user-id', '507f1f77bcf86cd799439015', '--clear-whatsapp-phone', '--clear-permissions',
  ]).body, { whatsappPhone: null, permissions: [] });
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'permissions', 'update', '--user-id', '507f1f77bcf86cd799439015', '--clear-permissions',
  ]).body, { permissions: [] });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'users', 'update', '--user-id', '507f1f77bcf86cd799439015', '--whatsapp-phone', '+639171234567',
      '--clear-whatsapp-phone',
    ]),
    /at most one of --whatsapp-phone or --clear-whatsapp-phone/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'users', 'permissions', 'update', '--user-id', '507f1f77bcf86cd799439015',
      '--permissions', 'boards.read', '--clear-permissions',
    ]),
    /at most one of --permissions or --clear-permissions/,
  );
});

test('requires real ObjectId selectors and a parent for subtasks', () => {
  assert.throws(
    () => buildRequest(commandCatalog, ['boards', 'get', '--board-id', 'board-1']),
    /24-character lowercase hexadecimal ObjectId/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'get', '--ticket-id', 'ticket-1']),
    /24-character lowercase hexadecimal ObjectId/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'move', '--ticket-id', '507f1f77bcf86cd799439012',
      '--column-id', 'column-2', '--before-ticket-id', 'ticket-2',
    ]),
    /24-character lowercase hexadecimal ObjectId/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011',
      '--ticket-type', 'subtask', '--title', 'Child',
    ]),
    /subtask.*exactly one of --parent-ticket-id or --parent-ticket-key/i,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'create', '--board-id', '507f1f77bcf86cd799439011',
    '--ticket-type', 'subtask', '--title', 'Child', '--parent-ticket-key', 'OPS-42',
  ]).body, {
    boardId: '507f1f77bcf86cd799439011', ticketType: 'subtask', title: 'Child',
    parentTicketKey: 'OPS-42',
  });
});

test('rejects locally valid-looking values that violate backend contracts', () => {
  assert.throws(() => buildRequest(commandCatalog, [
    'projects', 'create', '--name', 'x'.repeat(101),
  ]), /at most 100 characters/);
  assert.throws(() => buildRequest(commandCatalog, [
    'users', 'create', '--name', 'Sam', '--email', 'sam@example.com',
    '--permissions', 'projects:view,projects:view',
  ]), /must not contain duplicates/);
  assert.throws(() => buildRequest(commandCatalog, [
    'time', 'timers', 'start-many', '--projects', 'Project,project',
  ]), /case-insensitive duplicates/);
  assert.throws(() => buildRequest(commandCatalog, [
    'time', 'entries', 'create', '--projects', Array.from({ length: 21 }, (_, index) => `P${index}`).join(','),
    '--task', 'work', '--duration', '1',
  ]), /at most 20 values/);
  assert.throws(() => buildRequest(commandCatalog, [
    'time', 'entries', 'create', '--projects', 'Kooya', '--task', 'x'.repeat(1001), '--duration', '1',
  ]), /at most 1000 characters/);
  assert.throws(() => buildRequest(commandCatalog, [
    'time', 'entries', 'create', '--projects', 'Kooya', '--task', 'work', '--duration', '1000001',
  ]), /to 1000000/);
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'get', '--ticket-key', 'OPS-0']),
    /positive ticket sequence/,
  );
  assert.throws(() => buildRequest(commandCatalog, [
    'analytics', 'costs', 'budgets', 'create', '--start-date', '2026-08-01',
    '--end-date', '2026-08-01', '--amount', '100',
  ]), /must be before/);
  assert.throws(() => buildRequest(commandCatalog, [
    'analytics', 'costs', 'budgets', 'create', '--start-date', '2026-08-01',
    '--end-date', '2026-08-02', '--amount', '100', '--currency', '123',
  ]), /three ASCII letters/);
  assert.throws(() => buildRequest(commandCatalog, [
    'analytics', 'costs', 'budgets', 'update', '--budget-id', '507f1f77bcf86cd799439010',
    '--alert-thresholds-json', '{"warning":75}',
  ]), /does not match its JSON schema/);
  assert.throws(() => buildRequest(commandCatalog, [
    'analytics', 'costs', 'budgets', 'update', '--budget-id', '507f1f77bcf86cd799439010',
    '--alert-thresholds-json', '{"warning":95,"critical":90}',
  ]), /warning must not exceed critical/);
});

test('exposes search on backend-paginated ticket and cost lists', () => {
  for (const command of [
    ['tickets', 'comments', 'list', '--ticket-key', 'OPS-42', '--search', 'ready'],
    ['tickets', 'assigned', '--search', 'release'],
    ['tickets', 'activities', 'list', '--ticket-key', 'OPS-42', '--search', 'status'],
    ['tickets', 'viewers', 'list', '--ticket-key', 'OPS-42', '--search', 'sam'],
    ['tickets', 'subtasks', 'list', '--ticket-key', 'OPS-42', '--search', 'child'],
    ['analytics', 'costs', 'projects', 'list', '--search', 'Kooya'],
    ['analytics', 'costs', 'budgets', 'list', '--search', 'PHP'],
    ['analytics', 'costs', 'budgets', 'comparisons', '--search', 'Kooya'],
  ]) {
    assert.equal(buildRequest(commandCatalog, command).query.search, command.at(-1));
  }
});

test('maps the flattened improve and development contracts', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'improve-draft', '--board-key', 'OPS', '--title', 'Release',
    '--description-json', '{"type":"html","content":"<p>Release</p>"}',
    '--acceptance-criteria-json', '[{"text":"Verified"}]', '--ticket-type', 'task',
    '--user-command', 'Focus on rollback',
  ]).body, {
    boardKey: 'OPS', title: 'Release', description: { type: 'html', content: '<p>Release</p>' },
    acceptanceCriteria: [{ text: 'Verified' }], ticketType: 'task',
    userCommand: 'Focus on rollback',
  });
  assert.throws(
    () => buildRequest(commandCatalog, ['tickets', 'improve-draft', '--board-key', 'OPS']),
    /requires --title/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'improve', '--ticket-key', 'OPS-42', '--user-command', 'x'.repeat(2001),
    ]),
    /at most 2000 characters/,
  );
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'development', 'set', '--ticket-key', 'OPS-42', '--branch', 'feature/release',
  ]).body, { branchName: 'feature/release' });
});

test('validates permission list items against the backend permission catalog', () => {
  assert.deepEqual(buildRequest(commandCatalog, [
    'users', 'permissions', 'update', '--user-id', '507f1f77bcf86cd799439015',
    '--permissions', 'users:view,projects:manage',
  ]).body, { permissions: ['users:view', 'projects:manage'] });
  assert.throws(
    () => buildRequest(commandCatalog, [
      'users', 'permissions', 'update', '--user-id', '507f1f77bcf86cd799439015',
      '--permissions', 'users:view,projects.read',
    ]),
    /--permissions contains unsupported value projects\.read/,
  );
});

test('uses backend list limits and endpoint-specific sort fields', () => {
  assert.throws(
    () => buildRequest(commandCatalog, ['projects', 'list', '--page', '101']),
    /integer from 1 to 100/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['projects', 'list', '--limit', '101']),
    /integer from 1 to 100/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, [
      'boards', 'activities', 'list', '--board-key', 'OPS', '--sort', 'occurredAt',
    ]),
    /--sort must be createdAt/,
  );
  assert.equal(buildRequest(commandCatalog, [
    'boards', 'activities', 'list', '--board-key', 'OPS', '--sort', 'createdAt',
  ]).query.sortBy, 'createdAt');
  assert.equal(buildRequest(commandCatalog, [
    'users', 'templates', 'list', '--sort', 'label',
  ]).query.sortBy, 'label');
  assert.throws(
    () => buildRequest(commandCatalog, ['users', 'templates', 'list', '--sort', 'name']),
    /--sort must be id or label/,
  );
  assert.throws(
    () => buildRequest(commandCatalog, ['projects', 'list', '--all', '--page', '2']),
    /Do not combine --all with --page/,
  );
});

test('requires HTTPS for resource URLs even when localhost is used', () => {
  assert.throws(
    () => buildRequest(commandCatalog, [
      'tickets', 'documents', 'add', '--ticket-key', 'OPS-42', '--name', 'Local',
      '--type', 'doc', '--url', 'http://localhost:3000/spec',
    ]),
    /HTTPS URL/,
  );
});
