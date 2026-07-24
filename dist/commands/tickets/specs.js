import { id, listQuery } from '../shared.js';
const ticketCreateBody = {
    'board-id': { apiName: 'boardId' }, 'ticket-type': { apiName: 'ticketType' }, title: { apiName: 'title' },
    'description-json': { apiName: 'description', type: 'json-object' },
    'column-id': { apiName: 'columnId' }, points: { apiName: 'points', type: 'integer' },
    priority: { apiName: 'priority' }, tags: { apiName: 'tags', type: 'csv' },
    'assignee-id': { apiName: 'assigneeId' },
    'acceptance-criteria-json': { apiName: 'acceptanceCriteria', type: 'json-array' },
    'start-date': { apiName: 'startDate' }, 'end-date': { apiName: 'endDate' }, 'due-date': { apiName: 'dueDate' },
};
const { 'board-id': _boardId, 'ticket-type': _ticketType, ...ticketUpdateBody } = ticketCreateBody;
export const ticketCommands = [
    { name: 'tickets list', method: 'GET', path: '/tickets', query: listQuery({
            search: { apiName: 'search' }, 'board-id': { apiName: 'boardId' }, 'ticket-type': { apiName: 'ticketType' },
            'column-id': { apiName: 'columnId' }, 'assignee-id': { apiName: 'assigneeId' },
            priority: { apiName: 'priority' }, archived: { apiName: 'archived', type: 'boolean' },
        }), requiredOptions: ['board-id'] },
    { name: 'tickets get', method: 'GET', path: '/tickets/:id', positionals: [id()] },
    { name: 'tickets create', method: 'POST', path: '/tickets', body: ticketCreateBody, requireBody: true, requiredOptions: ['board-id', 'ticket-type', 'title'] },
    { name: 'tickets update', method: 'PATCH', path: '/tickets/:id', positionals: [id()], body: ticketUpdateBody, requireBody: true },
    { name: 'tickets delete', method: 'DELETE', path: '/tickets/:id', positionals: [id()], confirmation: 'Delete ticket {id}?' },
    { name: 'tickets comments list', method: 'GET', path: '/tickets/:ticketId/comments', positionals: [id('ticketId')], query: listQuery({
            'author-id': { apiName: 'authorId' },
        }) },
    { name: 'tickets comments create', method: 'POST', path: '/tickets/:ticketId/comments', positionals: [id('ticketId')], body: {
            content: { apiName: 'content' },
        }, requireBody: true },
    { name: 'tickets comments update', method: 'PATCH', path: '/tickets/:ticketId/comments/:commentId', positionals: [id('ticketId'), id('commentId')], body: {
            content: { apiName: 'content' },
        }, requireBody: true },
    { name: 'tickets comments delete', method: 'DELETE', path: '/tickets/:ticketId/comments/:commentId', positionals: [id('ticketId'), id('commentId')], confirmation: 'Delete comment {commentId}?' },
];
//# sourceMappingURL=specs.js.map