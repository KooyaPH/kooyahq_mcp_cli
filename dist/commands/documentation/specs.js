import { listQuery } from '../shared.js';
const FILE_MAX = 25 * 1024 * 1024;
export const documentationCommands = [
    {
        name: 'documentation list',
        method: 'GET',
        path: '/documentation',
        query: listQuery({
            category: { apiName: 'category' },
            type: { apiName: 'type' },
            search: { apiName: 'search' },
        }),
    },
    {
        name: 'documentation create-link',
        method: 'POST',
        path: '/documentation',
        body: {
            title: { apiName: 'title', maxLength: 200 },
            description: { apiName: 'description', maxLength: 5000 },
            category: { apiName: 'category', maxLength: 100 },
            url: { apiName: 'url', format: 'https-url' },
            visibility: { apiName: 'visibility', choices: ['team', 'restricted'] },
            'shared-with': { apiName: 'sharedWith', type: 'csv', itemMaxLength: 24, maxItems: 50 },
        },
        requiredOptions: ['title', 'category', 'url'],
    },
    {
        name: 'documentation create-file',
        method: 'POST',
        path: '/documentation/file',
        body: {
            title: { apiName: 'title', maxLength: 200 },
            description: { apiName: 'description', maxLength: 5000 },
            category: { apiName: 'category', maxLength: 100 },
            visibility: { apiName: 'visibility', choices: ['team', 'restricted'] },
            'shared-with': { apiName: 'sharedWith', type: 'csv', itemMaxLength: 24, maxItems: 50 },
        },
        requiredOptions: ['category'],
        multipartFiles: [{ flag: 'file', fieldName: 'file', maxBytes: FILE_MAX, required: true }],
    },
    {
        name: 'documentation update',
        method: 'PUT',
        path: '/documentation/:documentationId',
        pathParams: { 'documentation-id': { apiName: 'documentationId', format: 'object-id' } },
        requiredOptions: ['documentation-id'],
        body: {
            title: { apiName: 'title', maxLength: 200 },
            description: { apiName: 'description', maxLength: 5000 },
            category: { apiName: 'category', maxLength: 100 },
            url: { apiName: 'url', format: 'https-url' },
            visibility: { apiName: 'visibility', choices: ['team', 'restricted'] },
            'shared-with': { apiName: 'sharedWith', type: 'csv', itemMaxLength: 24, maxItems: 50 },
        },
        requireBody: true,
    },
    {
        name: 'documentation delete',
        method: 'DELETE',
        path: '/documentation/:documentationId',
        pathParams: { 'documentation-id': { apiName: 'documentationId', format: 'object-id' } },
        requiredOptions: ['documentation-id'],
        confirmation: 'Delete documentation {documentation-id}?',
    },
    {
        name: 'documentation pin',
        method: 'PATCH',
        path: '/documentation/:documentationId/pin',
        pathParams: { 'documentation-id': { apiName: 'documentationId', format: 'object-id' } },
        requiredOptions: ['documentation-id'],
    },
    {
        name: 'documentation unpin',
        method: 'PATCH',
        path: '/documentation/:documentationId/unpin',
        pathParams: { 'documentation-id': { apiName: 'documentationId', format: 'object-id' } },
        requiredOptions: ['documentation-id'],
    },
];
//# sourceMappingURL=specs.js.map