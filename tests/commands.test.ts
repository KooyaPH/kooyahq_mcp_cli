import assert from 'node:assert/strict';
import test from 'node:test';

import { commandCatalog, commandNames } from '../src/commands/catalog.js';
import { buildRequest } from '../src/commands/request.js';

const EXPECTED_COMMANDS = [
  'analytics costs', 'analytics projects', 'analytics team', 'analytics time',
  'auth whoami',
  'boards create', 'boards delete', 'boards favorite', 'boards get', 'boards list',
  'boards members add', 'boards members list', 'boards members remove', 'boards members update-role',
  'boards settings get', 'boards settings update', 'boards update',
  'notifications count', 'notifications list',
  'projects create', 'projects delete', 'projects get', 'projects list', 'projects update',
  'tickets comments create', 'tickets comments delete', 'tickets comments list', 'tickets comments update',
  'tickets create', 'tickets delete', 'tickets get', 'tickets list', 'tickets update',
  'time entries create', 'time entries delete', 'time entries get', 'time entries list', 'time entries update',
  'time timers add-task', 'time timers list', 'time timers pause', 'time timers resume',
  'time timers start', 'time timers stop', 'time timers stop-all',
  'users create', 'users delete', 'users get', 'users list', 'users permissions get',
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
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'members', 'update-role', 'board-1', 'user@example.com', '--role', 'admin',
  ]), {
    method: 'PATCH',
    path: '/boards/board-1/members',
    query: {},
    body: { userId: 'user@example.com', role: 'admin' },
    output: 'table',
  });
});

test('aligns favorite and member mutations with the backend body contract', () => {
  assert.deepEqual(buildRequest(commandCatalog, ['boards', 'favorite', 'board-1']), {
    method: 'POST', path: '/boards/board-1/favorite', query: {}, output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'boards', 'members', 'remove', 'board-1', 'user-1', '--yes',
  ]), {
    method: 'DELETE', path: '/boards/board-1/members', query: {}, body: { userId: 'user-1' }, output: 'table',
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
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'update', 'ticket-1', '--column-id', 'column-2',
  ]), {
    method: 'PATCH', path: '/tickets/ticket-1', query: {}, body: { columnId: 'column-2' }, output: 'table',
  });
  assert.deepEqual(buildRequest(commandCatalog, [
    'tickets', 'comments', 'create', 'ticket-1', '--content', 'Ready',
  ]), {
    method: 'POST', path: '/tickets/ticket-1/comments', query: {}, body: { content: 'Ready' }, output: 'table',
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

test('maps timer and entry fields without exposing user identities', () => {
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
  assert.throws(() => buildRequest(commandCatalog, ['time', 'entries', 'list', '--user-id', 'u1']), /Unknown option --user-id/);
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
