import { id, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const BOARD_FIELDS = ['priority', 'assignee', 'tags', 'parent', 'dueDate', 'startDate', 'endDate'];
const GITHUB_STATUSES = [
  'pull-requested',
  'pull-request-build-check-passed',
  'pull-request-build-check-failed',
  'deploying',
  'deployment-failed',
  'deployed',
];

function boardScope(suffix = ''): Pick<
  CommandSpec,
  'path' | 'pathParams' | 'pathVariants' | 'exactlyOne'
> {
  return {
    path: `/boards/:boardId${suffix}`,
    pathParams: {
      'board-id': { apiName: 'boardId', maxLength: 200 },
      'board-key': { apiName: 'boardKey', format: 'board-key' },
    },
    pathVariants: [
      { path: `/boards/:boardId${suffix}`, when: ['board-id'] },
      { path: `/boards/key/:boardKey${suffix}`, when: ['board-key'] },
    ],
    exactlyOne: [['board-id', 'board-key']],
  };
}

function boardChildScope(
  suffix: string,
  childFlag: string,
  childParam: string,
): Pick<CommandSpec, 'path' | 'pathParams' | 'pathVariants' | 'exactlyOne' | 'requiredOptions'> {
  const scoped = boardScope(suffix);
  return {
    ...scoped,
    pathParams: {
      ...scoped.pathParams,
      [childFlag]: { apiName: childParam },
    },
    requiredOptions: [childFlag],
  };
}

function legacyBoardScope(
  suffix = '',
  positionalName = 'id',
): ReturnType<typeof boardScope> & Pick<CommandSpec, 'positionals'> {
  return {
    ...boardScope(suffix),
    positionals: [{
      name: positionalName,
      optional: true,
      aliasFor: 'board-id',
      deprecated: true,
    }],
  };
}

const boardCreateBody = {
  name: { apiName: 'name', maxLength: 200 },
  type: { apiName: 'type', choices: ['kanban', 'sprint'] },
  description: { apiName: 'description', maxLength: 5000 },
  prefix: { apiName: 'prefix', format: 'board-key' as const }, emoji: { apiName: 'emoji', maxLength: 20 },
  'columns-json': { apiName: 'columns', type: 'json-array' as const },
  'settings-json': { apiName: 'settings', type: 'json-object' as const },
};
const { type: _type, ...boardUpdateBody } = boardCreateBody;
const settingsBody = {
  'default-view': { apiName: 'defaultView', choices: ['board', 'list', 'timeline'] },
  'show-swimlanes': { apiName: 'showSwimlanes', type: 'boolean' as const },
};

export const boardCommands: CommandSpec[] = [
  { name: 'boards list', method: 'GET', path: '/boards', query: listQuery({
    search: { apiName: 'search' }, type: { apiName: 'type', choices: ['kanban', 'sprint'] },
  }) },
  {
    name: 'boards get',
    method: 'GET',
    path: '/boards/:boardId',
    positionals: [{ name: 'id', optional: true, aliasFor: 'board-id', deprecated: true }],
    pathParams: {
      'board-id': { apiName: 'boardId', maxLength: 200 },
      'board-key': { apiName: 'boardKey', format: 'board-key' },
    },
    pathVariants: [
      { path: '/boards/:boardId', when: ['board-id'] },
      { path: '/boards/key/:boardKey', when: ['board-key'] },
    ],
    exactlyOne: [['board-id', 'board-key']],
  },
  { name: 'boards create', method: 'POST', path: '/boards', body: boardCreateBody, requireBody: true, requiredOptions: ['name', 'type'] },
  { name: 'boards update', method: 'PATCH', ...legacyBoardScope(), body: boardUpdateBody, requireBody: true },
  { name: 'boards delete', method: 'DELETE', ...legacyBoardScope(), confirmation: 'Delete board?' },
  { name: 'boards favorite', method: 'POST', ...legacyBoardScope('/favorite') },
  { name: 'boards settings get', method: 'GET', ...legacyBoardScope('/general-settings') },
  { name: 'boards settings update', method: 'PATCH', ...legacyBoardScope('/general-settings'), body: {
    name: { apiName: 'name' },
    description: { apiName: 'description' },
    'clear-description': { apiName: 'description', type: 'switch', constant: null },
    emoji: { apiName: 'emoji' },
    ...settingsBody,
  }, requireBody: true, atMostOne: [['description', 'clear-description']] },
  { name: 'boards members list', method: 'GET', ...legacyBoardScope('/members', 'boardId'), query: listQuery({
    search: { apiName: 'search' }, role: { apiName: 'role' },
  }) },
  {
    name: 'boards members add',
    method: 'POST',
    ...legacyBoardScope('/members', 'boardId'),
    body: {
      'user-id': { apiName: 'userId' },
      role: { apiName: 'role', choices: ['admin', 'member', 'viewer'] },
    },
    requireBody: true,
    requiredOptions: ['user-id', 'role'],
  },
  {
    name: 'boards members update-role',
    method: 'PATCH',
    ...legacyBoardScope('/members', 'boardId'),
    positionals: [
      {
        name: 'boardId', optional: true, aliasFor: 'board-id', deprecated: true,
      },
      {
        name: 'userId', optional: true, aliasFor: 'user-id', deprecated: true,
      },
    ],
    body: {
      'user-id': { apiName: 'userId' },
      role: { apiName: 'role', choices: ['admin', 'member', 'viewer'] },
    },
    requireBody: true,
    requiredOptions: ['user-id', 'role'],
  },
  {
    name: 'boards members remove',
    method: 'DELETE',
    ...legacyBoardScope('/members', 'boardId'),
    positionals: [
      {
        name: 'boardId', optional: true, aliasFor: 'board-id', deprecated: true,
      },
      {
        name: 'userId', optional: true, aliasFor: 'user-id', deprecated: true,
      },
    ],
    body: { 'user-id': { apiName: 'userId' } },
    requiredOptions: ['user-id'],
    confirmation: 'Remove board member?',
  },
  { name: 'boards activities list', method: 'GET', ...boardScope('/activities'), query: listQuery() },
  { name: 'boards mentions list', method: 'GET', ...boardScope('/mention-candidates'), query: listQuery({
    search: { apiName: 'search' },
  }) },
  { name: 'boards assignees list', method: 'GET', ...boardScope('/assignee-candidates'), query: listQuery({
    search: { apiName: 'search' },
  }) },
  { name: 'boards columns list', method: 'GET', ...boardScope('/columns') },
  {
    name: 'boards columns add',
    method: 'POST',
    ...boardScope('/columns'),
    body: {
      name: { apiName: 'name' },
      color: { apiName: 'color', format: 'hex-color' },
      'wip-limit': { apiName: 'wipLimit', type: 'integer' },
      done: { apiName: 'isDone', type: 'boolean' },
    },
    requireBody: true,
    requiredOptions: ['name'],
  },
  {
    name: 'boards columns update',
    method: 'PATCH',
    ...boardChildScope('/columns/:columnId', 'column-id', 'columnId'),
    body: {
      name: { apiName: 'name' },
      color: { apiName: 'color', format: 'hex-color' },
      'wip-limit': { apiName: 'wipLimit', type: 'integer' },
      done: { apiName: 'isDone', type: 'boolean' },
    },
    requireBody: true,
  },
  {
    name: 'boards columns move',
    method: 'PATCH',
    ...boardChildScope('/columns/:columnId/move', 'column-id', 'columnId'),
    body: {
      'before-column-id': { apiName: 'beforeColumnId' },
      'after-column-id': { apiName: 'afterColumnId' },
      first: { apiName: 'position', type: 'switch', constant: 'first' },
      last: { apiName: 'position', type: 'switch', constant: 'last' },
    },
    exactlyOne: [
      ['board-id', 'board-key'],
      ['before-column-id', 'after-column-id', 'first', 'last'],
    ],
  },
  {
    name: 'boards columns remove',
    method: 'DELETE',
    ...boardChildScope('/columns/:columnId', 'column-id', 'columnId'),
    body: { 'move-tickets-to': { apiName: 'moveTicketsToColumnId' } },
    confirmation: 'Remove column?',
  },
  {
    name: 'boards favorite toggle',
    method: 'POST',
    ...boardScope('/favorite'),
  },
  {
    name: 'boards favorite set',
    method: 'PATCH',
    ...boardScope('/favorite'),
    body: { favorite: { apiName: 'favorite', type: 'boolean' } },
    requiredOptions: ['favorite'],
  },
  {
    name: 'boards settings fields list',
    method: 'GET',
    ...boardScope('/ticket-detail-fields'),
  },
  {
    name: 'boards settings fields set',
    method: 'PATCH',
    ...boardScope('/ticket-detail-fields'),
    body: {
      field: { apiName: 'field', choices: BOARD_FIELDS },
      visible: { apiName: 'visible', type: 'boolean' },
      order: { apiName: 'order', type: 'integer', min: 0 },
    },
    requiredOptions: ['field'],
    requireBody: true,
  },
  {
    name: 'boards settings fields reset',
    method: 'POST',
    ...boardScope('/ticket-detail-fields/reset'),
    confirmation: 'Reset board ticket detail fields?',
  },
  {
    name: 'boards automation list',
    method: 'GET',
    ...boardScope('/github-automation-rules'),
  },
  {
    name: 'boards automation add',
    method: 'POST',
    ...boardScope('/github-automation-rules'),
    body: {
      enabled: { apiName: 'enabled', type: 'boolean' },
      status: { apiName: 'status', choices: GITHUB_STATUSES },
      'target-branch': { apiName: 'targetBranch' },
      'column-id': { apiName: 'columnId' },
      description: { apiName: 'description' },
    },
    requiredOptions: ['status', 'column-id'],
    requireBody: true,
  },
  {
    name: 'boards automation update',
    method: 'PATCH',
    ...boardChildScope('/github-automation-rules/:ruleId', 'rule-id', 'ruleId'),
    body: {
      enabled: { apiName: 'enabled', type: 'boolean' },
      status: { apiName: 'status', choices: GITHUB_STATUSES },
      'target-branch': { apiName: 'targetBranch' },
      'column-id': { apiName: 'columnId' },
      description: { apiName: 'description' },
      'clear-target-branch': { apiName: 'targetBranch', type: 'switch', constant: null },
      'clear-description': { apiName: 'description', type: 'switch', constant: null },
    },
    requireBody: true,
    atMostOne: [
      ['target-branch', 'clear-target-branch'],
      ['description', 'clear-description'],
    ],
  },
  {
    name: 'boards automation remove',
    method: 'DELETE',
    ...boardChildScope('/github-automation-rules/:ruleId', 'rule-id', 'ruleId'),
    confirmation: 'Remove GitHub automation rule?',
  },
];
