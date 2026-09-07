import { id, listQuery } from '../shared.js';
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
const RICH_TEXT_SCHEMA = {
    type: 'object',
    required: ['type', 'content'],
    properties: {
        type: { const: 'html' },
        content: { type: 'string', maxLength: 100_000 },
    },
    additionalProperties: false,
};
const RICH_TEXT_EXAMPLE = '{"type":"html","content":"<p>Ready to ship</p>"}';
const ACCEPTANCE_CRITERIA_SCHEMA = {
    type: 'array',
    items: {
        type: 'object',
        required: ['text'],
        properties: {
            text: { type: 'string' },
            completed: { type: 'boolean' },
        },
        additionalProperties: false,
    },
};
const ACCEPTANCE_CRITERIA_EXAMPLE = '[{"text":"Verified","completed":false}]';
function ticketScope(suffix = '') {
    return {
        path: `/tickets/:ticketId${suffix}`,
        pathParams: {
            'ticket-id': { apiName: 'ticketId', format: 'object-id' },
            'ticket-key': { apiName: 'ticketKey', format: 'ticket-key' },
        },
        pathVariants: [
            { path: `/tickets/:ticketId${suffix}`, when: ['ticket-id'] },
            { path: `/tickets/key/:ticketKey${suffix}`, when: ['ticket-key'] },
        ],
        exactlyOne: [['ticket-id', 'ticket-key']],
    };
}
function ticketChildScope(suffix, childFlag, childParam) {
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
function legacyTicketScope(suffix = '', positionalName = 'id') {
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
function legacyTicketChildScope(suffix, childFlag, childParam, ticketPositionalName = 'ticketId', childPositionalName = 'commentId') {
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
    'board-id': { apiName: 'boardId', format: 'object-id' },
    'board-key': { apiName: 'boardKey', format: 'board-key' },
    'ticket-type': { apiName: 'ticketType', choices: TICKET_TYPES },
    title: { apiName: 'title', maxLength: 500 },
    'description-json': {
        apiName: 'description', type: 'json-object',
        jsonSchema: RICH_TEXT_SCHEMA, example: RICH_TEXT_EXAMPLE,
    },
    'column-id': { apiName: 'columnId' },
    points: { apiName: 'points', type: 'integer', numericChoices: [1, 2, 3, 5, 8, 13] },
    priority: { apiName: 'priority', choices: PRIORITIES }, tags: { apiName: 'tags', type: 'csv' },
    'assignee-id': { apiName: 'assigneeId', format: 'object-id' },
    'acceptance-criteria-json': {
        apiName: 'acceptanceCriteria', type: 'json-array',
        jsonSchema: ACCEPTANCE_CRITERIA_SCHEMA, example: ACCEPTANCE_CRITERIA_EXAMPLE,
    },
    'parent-ticket-id': { apiName: 'parentTicketId', format: 'object-id' },
    'parent-ticket-key': { apiName: 'parentTicketKey', format: 'ticket-key' },
    'root-epic-id': { apiName: 'rootEpicId', format: 'object-id' },
    'root-epic-key': { apiName: 'rootEpicKey', format: 'ticket-key' },
    'start-date': { apiName: 'startDate', format: 'date' },
    'end-date': { apiName: 'endDate', format: 'date' },
    'due-date': { apiName: 'dueDate', format: 'date' },
};
const { 'board-id': _boardId, 'board-key': _boardKey, 'ticket-type': _ticketType, 'column-id': _columnId, 'parent-ticket-id': _parentTicketId, 'parent-ticket-key': _parentTicketKey, 'root-epic-id': _rootEpicId, 'root-epic-key': _rootEpicKey, ...ticketUpdateBody } = ticketCreateBody;
const ticketUpdateWithClearBody = {
    ...ticketUpdateBody,
    'clear-description': {
        apiName: 'description',
        type: 'switch',
        constant: { type: 'html', content: '' },
    },
    'clear-assignee': { apiName: 'assigneeId', type: 'switch', constant: null },
    'clear-points': { apiName: 'points', type: 'switch', constant: null },
    'clear-tags': { apiName: 'tags', type: 'switch', constant: [] },
    'clear-start-date': { apiName: 'startDate', type: 'switch', constant: null },
    'clear-end-date': { apiName: 'endDate', type: 'switch', constant: null },
    'clear-due-date': { apiName: 'dueDate', type: 'switch', constant: null },
};
export const ticketCommands = [
    { name: 'tickets list', method: 'GET', path: '/tickets', query: listQuery({
            search: { apiName: 'search' },
            'board-id': { apiName: 'boardId', format: 'object-id' },
            'board-key': { apiName: 'boardKey', format: 'board-key' },
            'ticket-type': { apiName: 'ticketType', choices: TICKET_TYPES },
            'column-id': { apiName: 'columnId' }, 'assignee-id': { apiName: 'assigneeId', format: 'object-id' },
            priority: { apiName: 'priority', choices: PRIORITIES }, archived: { apiName: 'archived', type: 'boolean' },
        }, ['createdAt']), exactlyOne: [['board-id', 'board-key']] },
    { name: 'tickets get', method: 'GET', ...legacyTicketScope() },
    {
        name: 'tickets create',
        method: 'POST',
        path: '/tickets',
        body: ticketCreateBody,
        requireBody: true,
        requiredOptions: ['ticket-type', 'title'],
        exactlyOne: [['board-id', 'board-key']],
        atMostOne: [
            ['parent-ticket-id', 'parent-ticket-key'],
            ['root-epic-id', 'root-epic-key'],
        ],
        conditionalExactlyOne: [{
                when: { option: 'ticket-type', value: 'subtask' },
                options: ['parent-ticket-id', 'parent-ticket-key'],
            }],
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
            'author-id': { apiName: 'authorId', format: 'object-id' },
            search: { apiName: 'search', maxLength: 200 },
        }, ['createdAt']) },
    {
        name: 'tickets comments create',
        method: 'POST',
        ...legacyTicketScope('/comments', 'ticketId'),
        body: {
            content: { apiName: 'content' },
            'content-json': {
                apiName: 'content', type: 'json-object',
                jsonSchema: RICH_TEXT_SCHEMA, example: RICH_TEXT_EXAMPLE,
            },
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
            'content-json': {
                apiName: 'content', type: 'json-object',
                jsonSchema: RICH_TEXT_SCHEMA, example: RICH_TEXT_EXAMPLE,
            },
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
            'board-id': { apiName: 'boardId', format: 'object-id' },
            'board-key': { apiName: 'boardKey', format: 'board-key' },
            archived: { apiName: 'archived', type: 'boolean' },
        }, ['createdAt']), requiredOptions: ['query'],
        atMostOne: [['board-id', 'board-key']] },
    { name: 'tickets assigned', method: 'GET', path: '/tickets/assigned', query: listQuery({
            'board-id': { apiName: 'boardId', format: 'object-id' },
            'board-key': { apiName: 'boardKey', format: 'board-key' },
            archived: { apiName: 'archived', type: 'boolean' },
            search: { apiName: 'search', maxLength: 200 },
        }, ['createdAt']),
        atMostOne: [['board-id', 'board-key']] },
    { name: 'tickets detail', method: 'GET', ...ticketScope('/detail') },
    { name: 'tickets activities list', method: 'GET', ...ticketScope('/activities'), query: listQuery({
            search: { apiName: 'search', maxLength: 200 },
        }, ['createdAt']) },
    { name: 'tickets viewers list', method: 'GET', ...ticketScope('/viewers'), query: listQuery({
            search: { apiName: 'search', maxLength: 200 },
        }, ['name', 'email']) },
    { name: 'tickets archive', method: 'POST', ...ticketScope('/archive') },
    { name: 'tickets unarchive', method: 'POST', ...ticketScope('/unarchive') },
    {
        name: 'tickets move',
        method: 'PATCH',
        ...ticketScope('/move'),
        body: {
            'column-id': { apiName: 'columnId' },
            'before-ticket-id': { apiName: 'beforeTicketId', format: 'object-id' },
            'before-ticket-key': { apiName: 'beforeTicketKey', format: 'ticket-key' },
            'after-ticket-id': { apiName: 'afterTicketId', format: 'object-id' },
            'after-ticket-key': { apiName: 'afterTicketKey', format: 'ticket-key' },
            first: { apiName: 'position', type: 'switch', constant: 'first' },
            last: { apiName: 'position', type: 'switch', constant: 'last' },
        },
        requiredOptions: ['column-id'],
        exactlyOne: [
            ['ticket-id', 'ticket-key'],
            [
                'before-ticket-id', 'before-ticket-key', 'after-ticket-id', 'after-ticket-key',
                'first', 'last',
            ],
        ],
    },
    {
        name: 'tickets improve',
        method: 'POST',
        ...ticketScope('/improve'),
        body: {
            'user-command': { apiName: 'userCommand', maxLength: 2000 },
        },
    },
    {
        name: 'tickets improve-draft',
        method: 'POST',
        path: '/tickets/improve-draft',
        body: {
            'board-id': { apiName: 'boardId', format: 'object-id' },
            'board-key': { apiName: 'boardKey', format: 'board-key' },
            title: { apiName: 'title', maxLength: 500 },
            'description-json': {
                apiName: 'description', type: 'json-object',
                jsonSchema: RICH_TEXT_SCHEMA, example: RICH_TEXT_EXAMPLE,
            },
            'acceptance-criteria-json': {
                apiName: 'acceptanceCriteria', type: 'json-array',
                jsonSchema: ACCEPTANCE_CRITERIA_SCHEMA, example: ACCEPTANCE_CRITERIA_EXAMPLE,
            },
            'ticket-type': { apiName: 'ticketType', choices: TICKET_TYPES },
            'user-command': { apiName: 'userCommand', maxLength: 2000 },
        },
        requiredOptions: ['title'],
        exactlyOne: [['board-id', 'board-key']],
    },
    {
        name: 'tickets parent set',
        method: 'PATCH',
        ...ticketScope('/parent'),
        body: {
            'parent-ticket-id': { apiName: 'parentTicketId', format: 'object-id' },
            'parent-ticket-key': { apiName: 'parentTicketKey', format: 'ticket-key' },
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
            'epic-ticket-id': { apiName: 'epicTicketId', format: 'object-id' },
            'epic-ticket-key': { apiName: 'epicTicketKey', format: 'ticket-key' },
        },
        exactlyOne: [
            ['ticket-id', 'ticket-key'],
            ['epic-ticket-id', 'epic-ticket-key'],
        ],
    },
    { name: 'tickets epic clear', method: 'DELETE', ...ticketScope('/epic') },
    { name: 'tickets subtasks list', method: 'GET', ...ticketScope('/subtasks'), query: listQuery({
            search: { apiName: 'search', maxLength: 200 },
        }, ['createdAt']) },
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
            name: { apiName: 'name', maxLength: 500 },
        },
        requiredOptions: ['type', 'url', 'name'],
    },
    {
        name: 'tickets documents remove',
        method: 'DELETE',
        ...ticketScope('/documents'),
        body: { url: { apiName: 'url', format: 'https-url', maxLength: 2048 } },
        requiredOptions: ['url'],
        confirmation: 'Remove document reference?',
    },
    { name: 'tickets relations list', method: 'GET', ...ticketScope('/related-tickets') },
    {
        name: 'tickets relations add',
        method: 'POST',
        ...ticketScope('/related-tickets'),
        body: {
            'related-ticket-id': { apiName: 'relatedTicketId', format: 'object-id' },
            'related-ticket-key': { apiName: 'relatedTicketKey', format: 'ticket-key' },
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
            'related-ticket-id': { apiName: 'relatedTicketId', format: 'object-id' },
            'related-ticket-key': { apiName: 'relatedTicketKey', format: 'ticket-key' },
        },
        exactlyOne: [
            ['ticket-id', 'ticket-key'],
            ['related-ticket-id', 'related-ticket-key'],
        ],
        confirmation: 'Remove related ticket?',
    },
    {
        name: 'tickets blockers list',
        method: 'GET',
        ...ticketScope('/blockers'),
        query: { direction: { apiName: 'direction', choices: ['blocked-by', 'blocking', 'all'] } },
        response: {
            description: 'Returns a relationship envelope with blockedBy and blocking ticket arrays.',
            fields: ['blockedBy', 'blocking'],
        },
    },
    {
        name: 'tickets blockers add',
        method: 'POST',
        ...ticketScope('/blockers'),
        body: {
            'blocker-ticket-id': { apiName: 'blockerTicketId', format: 'object-id' },
            'blocker-ticket-key': { apiName: 'blockerTicketKey', format: 'ticket-key' },
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
            'blocker-ticket-id': { apiName: 'blockerTicketId', format: 'object-id' },
            'blocker-ticket-key': { apiName: 'blockerTicketKey', format: 'ticket-key' },
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
            branch: { apiName: 'branchName' },
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
            'board-id': { apiName: 'boardId', format: 'object-id' },
            'board-key': { apiName: 'boardKey', format: 'board-key' },
        },
        exactlyOne: [['board-id', 'board-key']],
        fileInput: { bodyName: 'rows', maxBytes: 5 * 1024 * 1024, maxItems: 250 },
    },
    {
        name: 'tickets import apply',
        method: 'POST',
        path: '/tickets/import',
        body: {
            'board-id': { apiName: 'boardId', format: 'object-id' },
            'board-key': { apiName: 'boardKey', format: 'board-key' },
            'operation-id': { apiName: 'operationId', format: 'uuid' },
        },
        exactlyOne: [['board-id', 'board-key']],
        requiredOptions: ['operation-id'],
        fileInput: { bodyName: 'rows', maxBytes: 5 * 1024 * 1024, maxItems: 250 },
        confirmation: 'Import tickets?',
    },
];
//# sourceMappingURL=specs.js.map