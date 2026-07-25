import { id, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const TICKET_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'];
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
const DOCUMENT_TYPES = ['doc', 'sheet', 'slide', 'figma', 'other'];
const DEVELOPMENT_STATUSES = [
  'pull-requested',
  'pull-request-build-check-passed',
  'pull-request-build-check-failed',
  'deploying',
  'deployment-failed',
  'deployed',
];

function ticketScope(suffix = ''): Pick<
  CommandSpec,
  'path' | 'pathParams' | 'pathVariants' | 'exactlyOne'
> {
  return {
    path: `/tickets/:ticketId${suffix}`,
    pathParams: {
      'ticket-id': { apiName: 'ticketId', maxLength: 200 },
      'ticket-key': { apiName: 'ticketKey', format: 'ticket-key' },
    },
    pathVariants: [
      { path: `/tickets/:ticketId${suffix}`, when: ['ticket-id'] },
      { path: `/tickets/key/:ticketKey${suffix}`, when: ['ticket-key'] },
    ],
    exactlyOne: [['ticket-id', 'ticket-key']],
  };
}

function ticketChildScope(
  suffix: string,
  childFlag: string,
  childParam: string,
): Pick<CommandSpec, 'path' | 'pathParams' | 'pathVariants' | 'exactlyOne' | 'requiredOptions'> {
  const scoped = ticketScope(suffix);
  return {
    ...scoped,
    pathParams: {
      ...scoped.pathParams,
      [childFlag]: { apiName: childParam },
    },
    requiredOptions: [childFlag],
  };
}

function legacyTicketScope(
  suffix = '',
  positionalName = 'id',
): ReturnType<typeof ticketScope> & Pick<CommandSpec, 'positionals'> {
  return {
    ...ticketScope(suffix),
    positionals: [{
      name: positionalName,
      optional: true,
      aliasFor: 'ticket-id',
      deprecated: true,
    }],
  };
}

function legacyTicketChildScope(
  suffix: string,
  childFlag: string,
  childParam: string,
  ticketPositionalName = 'ticketId',
  childPositionalName = 'commentId',
): ReturnType<typeof ticketChildScope> & Pick<CommandSpec, 'positionals'> {
  return {
    ...ticketChildScope(suffix, childFlag, childParam),
    positionals: [
      {
        name: ticketPositionalName,
        optional: true,
        aliasFor: 'ticket-id',
        deprecated: true,
      },
      {
        name: childPositionalName,
        optional: true,
        aliasFor: childFlag,
        deprecated: true,
      },
    ],
  };
}

const ticketCreateBody = {
  'board-id': { apiName: 'boardId', maxLength: 200 },
  'board-key': { apiName: 'boardKey', format: 'board-key' as const },
  'ticket-type': { apiName: 'ticketType', choices: TICKET_TYPES },
  title: { apiName: 'title', maxLength: 500 },
  'description-json': { apiName: 'description', type: 'json-object' as const },
  'column-id': { apiName: 'columnId' },
  points: { apiName: 'points', type: 'integer' as const, numericChoices: [1, 2, 3, 5, 8, 13] },
  priority: { apiName: 'priority', choices: PRIORITIES }, tags: { apiName: 'tags', type: 'csv' as const },
  'assignee-id': { apiName: 'assigneeId' },
  'acceptance-criteria-json': { apiName: 'acceptanceCriteria', type: 'json-array' as const },
  'start-date': { apiName: 'startDate', format: 'date' as const },
  'end-date': { apiName: 'endDate', format: 'date' as const },
  'due-date': { apiName: 'dueDate', format: 'date' as const },
};
const {
  'board-id': _boardId,
  'board-key': _boardKey,
  'ticket-type': _ticketType,
  ...ticketUpdateBody
} = ticketCreateBody;
const ticketUpdateWithClearBody = {
  ...ticketUpdateBody,
  'clear-description': { apiName: 'description', type: 'switch' as const, constant: null },
  'clear-assignee': { apiName: 'assigneeId', type: 'switch' as const, constant: null },
  'clear-points': { apiName: 'points', type: 'switch' as const, constant: null },
  'clear-tags': { apiName: 'tags', type: 'switch' as const, constant: null },
  'clear-start-date': { apiName: 'startDate', type: 'switch' as const, constant: null },
  'clear-end-date': { apiName: 'endDate', type: 'switch' as const, constant: null },
  'clear-due-date': { apiName: 'dueDate', type: 'switch' as const, constant: null },
};

export const ticketCommands: CommandSpec[] = [
  { name: 'tickets list', method: 'GET', path: '/tickets', query: listQuery({
    search: { apiName: 'search' },
    'board-id': { apiName: 'boardId' },
    'board-key': { apiName: 'boardKey', format: 'board-key' },
    'ticket-type': { apiName: 'ticketType', choices: TICKET_TYPES },
    'column-id': { apiName: 'columnId' }, 'assignee-id': { apiName: 'assigneeId' },
    priority: { apiName: 'priority', choices: PRIORITIES }, archived: { apiName: 'archived', type: 'boolean' },
  }), exactlyOne: [['board-id', 'board-key']] },
  { name: 'tickets get', method: 'GET', ...legacyTicketScope() },
  {
    name: 'tickets create',
    method: 'POST',
    path: '/tickets',
    body: ticketCreateBody,
    requireBody: true,
    requiredOptions: ['ticket-type', 'title'],
    exactlyOne: [['board-id', 'board-key']],
  },
  {
    name: 'tickets update',
    method: 'PATCH',
    ...legacyTicketScope(),
    body: ticketUpdateWithClearBody,
    requireBody: true,
    atMostOne: [
      ['description-json', 'clear-description'],
      ['assignee-id', 'clear-assignee'],
      ['points', 'clear-points'],
      ['tags', 'clear-tags'],
      ['start-date', 'clear-start-date'],
      ['end-date', 'clear-end-date'],
      ['due-date', 'clear-due-date'],
    ],
  },
  { name: 'tickets delete', method: 'DELETE', ...legacyTicketScope(), confirmation: 'Delete ticket?' },
  { name: 'tickets comments list', method: 'GET', ...legacyTicketScope('/comments', 'ticketId'), query: listQuery({
    'author-id': { apiName: 'authorId' },
  }) },
  {
    name: 'tickets comments create',
    method: 'POST',
    ...legacyTicketScope('/comments', 'ticketId'),
    body: {
      content: { apiName: 'content' },
      'content-json': { apiName: 'content', type: 'json-object' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['content', 'content-json'],
    ],
  },
  {
    name: 'tickets comments update',
    method: 'PATCH',
    ...legacyTicketChildScope('/comments/:commentId', 'comment-id', 'commentId'),
    body: {
      content: { apiName: 'content' },
      'content-json': { apiName: 'content', type: 'json-object' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['content', 'content-json'],
    ],
    requiredOptions: ['comment-id'],
  },
  {
    name: 'tickets comments delete',
    method: 'DELETE',
    ...legacyTicketChildScope('/comments/:commentId', 'comment-id', 'commentId'),
    requiredOptions: ['comment-id'],
    confirmation: 'Delete comment?',
  },
  { name: 'tickets search', method: 'GET', path: '/tickets/search', query: listQuery({
    query: { apiName: 'q' },
    'board-id': { apiName: 'boardId' },
    'board-key': { apiName: 'boardKey', format: 'board-key' },
    archived: { apiName: 'archived', type: 'boolean' },
  }), requiredOptions: ['query'] },
  { name: 'tickets assigned', method: 'GET', path: '/tickets/assigned', query: listQuery({
    'board-id': { apiName: 'boardId' },
    'board-key': { apiName: 'boardKey' },
    archived: { apiName: 'archived', type: 'boolean' },
  }) },
  { name: 'tickets detail', method: 'GET', ...ticketScope('/detail') },
  { name: 'tickets activities list', method: 'GET', ...ticketScope('/activities'), query: listQuery() },
  { name: 'tickets viewers list', method: 'GET', ...ticketScope('/viewers'), query: listQuery() },
  { name: 'tickets archive', method: 'POST', ...ticketScope('/archive') },
  { name: 'tickets unarchive', method: 'POST', ...ticketScope('/unarchive') },
  {
    name: 'tickets move',
    method: 'PATCH',
    ...ticketScope('/move'),
    body: {
      'column-id': { apiName: 'columnId' },
      'before-ticket-id': { apiName: 'beforeTicketId' },
      'after-ticket-id': { apiName: 'afterTicketId' },
      first: { apiName: 'position', type: 'switch', constant: 'first' },
      last: { apiName: 'position', type: 'switch', constant: 'last' },
    },
    requiredOptions: ['column-id'],
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['before-ticket-id', 'after-ticket-id', 'first', 'last'],
    ],
  },
  {
    name: 'tickets improve',
    method: 'POST',
    ...ticketScope('/improve'),
    body: {
      instructions: { apiName: 'instructions' },
      'apply-fields': { apiName: 'applyFields', type: 'csv' },
    },
  },
  {
    name: 'tickets improve-draft',
    method: 'POST',
    path: '/tickets/improve-draft',
    body: {
      'board-id': { apiName: 'boardId' },
      'board-key': { apiName: 'boardKey' },
      'draft-json': { apiName: 'draft', type: 'json-object' },
      instructions: { apiName: 'instructions' },
    },
    requiredOptions: ['draft-json'],
    exactlyOne: [['board-id', 'board-key']],
  },
  {
    name: 'tickets parent set',
    method: 'PATCH',
    ...ticketScope('/parent'),
    body: {
      'parent-ticket-id': { apiName: 'parentTicketId' },
      'parent-ticket-key': { apiName: 'parentTicketKey' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['parent-ticket-id', 'parent-ticket-key'],
    ],
  },
  { name: 'tickets parent clear', method: 'DELETE', ...ticketScope('/parent') },
  {
    name: 'tickets epic set',
    method: 'PATCH',
    ...ticketScope('/epic'),
    body: {
      'epic-ticket-id': { apiName: 'epicTicketId' },
      'epic-ticket-key': { apiName: 'epicTicketKey' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['epic-ticket-id', 'epic-ticket-key'],
    ],
  },
  { name: 'tickets epic clear', method: 'DELETE', ...ticketScope('/epic') },
  { name: 'tickets subtasks list', method: 'GET', ...ticketScope('/subtasks'), query: listQuery() },
  { name: 'tickets criteria list', method: 'GET', ...ticketScope('/acceptance-criteria') },
  {
    name: 'tickets criteria add',
    method: 'POST',
    ...ticketScope('/acceptance-criteria'),
    body: { text: { apiName: 'text' } },
    requiredOptions: ['text'],
  },
  {
    name: 'tickets criteria set',
    method: 'PATCH',
    ...ticketChildScope('/acceptance-criteria/:criterionId', 'criterion-id', 'criterionId'),
    body: {
      text: { apiName: 'text' },
      completed: { apiName: 'completed', type: 'boolean' },
    },
    requireBody: true,
  },
  {
    name: 'tickets criteria remove',
    method: 'DELETE',
    ...ticketChildScope('/acceptance-criteria/:criterionId', 'criterion-id', 'criterionId'),
    confirmation: 'Remove acceptance criterion?',
  },
  { name: 'tickets documents list', method: 'GET', ...ticketScope('/documents') },
  {
    name: 'tickets documents add',
    method: 'POST',
    ...ticketScope('/documents'),
    body: {
      type: { apiName: 'type', choices: DOCUMENT_TYPES },
      url: { apiName: 'url', format: 'https-url', maxLength: 2048 },
      title: { apiName: 'title' },
    },
    requiredOptions: ['type', 'url'],
  },
  {
    name: 'tickets documents remove',
    method: 'DELETE',
    ...ticketChildScope('/documents/:documentId', 'document-id', 'documentId'),
    confirmation: 'Remove document reference?',
  },
  { name: 'tickets relations list', method: 'GET', ...ticketScope('/related-tickets') },
  {
    name: 'tickets relations add',
    method: 'POST',
    ...ticketScope('/related-tickets'),
    body: {
      'related-ticket-id': { apiName: 'relatedTicketId' },
      'related-ticket-key': { apiName: 'relatedTicketKey' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['related-ticket-id', 'related-ticket-key'],
    ],
  },
  {
    name: 'tickets relations remove',
    method: 'DELETE',
    ...ticketScope('/related-tickets'),
    body: {
      'related-ticket-id': { apiName: 'relatedTicketId' },
      'related-ticket-key': { apiName: 'relatedTicketKey' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['related-ticket-id', 'related-ticket-key'],
    ],
    confirmation: 'Remove related ticket?',
  },
  { name: 'tickets blockers list', method: 'GET', ...ticketScope('/blockers') },
  {
    name: 'tickets blockers add',
    method: 'POST',
    ...ticketScope('/blockers'),
    body: {
      'blocker-ticket-id': { apiName: 'blockerTicketId' },
      'blocker-ticket-key': { apiName: 'blockerTicketKey' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['blocker-ticket-id', 'blocker-ticket-key'],
    ],
  },
  {
    name: 'tickets blockers remove',
    method: 'DELETE',
    ...ticketScope('/blockers'),
    body: {
      'blocker-ticket-id': { apiName: 'blockerTicketId' },
      'blocker-ticket-key': { apiName: 'blockerTicketKey' },
    },
    exactlyOne: [
      ['ticket-id', 'ticket-key'],
      ['blocker-ticket-id', 'blocker-ticket-key'],
    ],
    confirmation: 'Remove blocker?',
  },
  { name: 'tickets development get', method: 'GET', ...ticketScope('/development') },
  {
    name: 'tickets development set',
    method: 'PATCH',
    ...ticketScope('/development'),
    body: {
      branch: { apiName: 'branch' },
      status: { apiName: 'status', choices: DEVELOPMENT_STATUSES },
      'pull-request-url': { apiName: 'pullRequestUrl', format: 'https-url', maxLength: 2048 },
      'target-branch': { apiName: 'targetBranch' },
    },
    requireBody: true,
  },
  {
    name: 'tickets development clear',
    method: 'DELETE',
    ...ticketScope('/development'),
    confirmation: 'Clear ticket development data?',
  },
  {
    name: 'tickets import preview',
    method: 'POST',
    path: '/tickets/import/preview',
    body: {
      'board-id': { apiName: 'boardId' },
      'board-key': { apiName: 'boardKey' },
    },
    exactlyOne: [['board-id', 'board-key']],
    fileInput: { bodyName: 'tickets', maxBytes: 5 * 1024 * 1024, maxItems: 250 },
  },
  {
    name: 'tickets import apply',
    method: 'POST',
    path: '/tickets/import',
    body: {
      'board-id': { apiName: 'boardId' },
      'board-key': { apiName: 'boardKey' },
    },
    exactlyOne: [['board-id', 'board-key']],
    fileInput: { bodyName: 'tickets', maxBytes: 5 * 1024 * 1024, maxItems: 250 },
    confirmation: 'Import tickets?',
  },
];
