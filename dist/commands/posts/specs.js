import { listQuery } from '../shared.js';
const IMAGE_MAX = 5 * 1024 * 1024;
const MENTION_HELP = 'Mention users with @[Name](userId); get user IDs from `kooyahq users list`.';
const POST_CONTENT = {
    apiName: 'content',
    maxLength: 50_000,
    description: `Post body, interpreted by --format. ${MENTION_HELP}`,
};
const POST_FORMAT = {
    apiName: 'format',
    choices: ['markdown', 'text'],
    description: 'How --content is rendered: markdown, or plain text with line breaks kept.',
};
const COMMENT_CONTENT = {
    apiName: 'content',
    maxLength: 10_000,
    description: `Plain-text comment. ${MENTION_HELP}`,
};
export const postCommands = [
    {
        name: 'posts list',
        method: 'GET',
        path: '/posts',
        query: listQuery({
            category: { apiName: 'category' },
            search: { apiName: 'search' },
        }),
    },
    {
        name: 'posts list-mine',
        method: 'GET',
        path: '/posts/me',
        query: listQuery(),
    },
    {
        name: 'posts create',
        method: 'POST',
        path: '/posts',
        body: {
            content: POST_CONTENT,
            format: POST_FORMAT,
            category: { apiName: 'category', maxLength: 100 },
            tags: { apiName: 'tags', type: 'csv', maxItems: 20, itemMaxLength: 50 },
            draft: { apiName: 'draft', type: 'boolean' },
            poll: {
                apiName: 'poll',
                type: 'json-object',
                jsonSchema: {
                    type: 'object',
                    required: ['question', 'options'],
                    additionalProperties: false,
                    properties: {
                        question: { type: 'string', minLength: 1, maxLength: 500 },
                        options: {
                            type: 'array',
                            minItems: 2,
                            maxItems: 10,
                            items: { type: 'string', minLength: 1, maxLength: 200 },
                        },
                    },
                },
                example: '{"question":"Ship Friday?","options":["Yes","No"]}',
            },
        },
        multipartFiles: [{ flag: 'image', fieldName: 'image', maxBytes: IMAGE_MAX }],
        atLeastOne: [['content', 'image', 'poll']],
    },
    {
        name: 'posts update',
        method: 'PUT',
        path: '/posts/:postId',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id'],
        body: {
            content: POST_CONTENT,
            format: POST_FORMAT,
            category: { apiName: 'category', maxLength: 100 },
            tags: { apiName: 'tags', type: 'csv', maxItems: 20, itemMaxLength: 50 },
            draft: { apiName: 'draft', type: 'boolean' },
        },
        multipartFiles: [{ flag: 'image', fieldName: 'image', maxBytes: IMAGE_MAX }],
        atLeastOne: [['content', 'category', 'tags', 'draft', 'image']],
    },
    {
        name: 'posts delete',
        method: 'DELETE',
        path: '/posts/:postId',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id'],
        confirmation: 'Delete post {post-id}?',
    },
    {
        name: 'posts poll vote',
        method: 'POST',
        path: '/posts/:postId/poll/vote',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id', 'option-index'],
        body: {
            'option-index': { apiName: 'optionIndex', type: 'integer', min: 0 },
        },
    },
    {
        name: 'posts comments list',
        method: 'GET',
        path: '/posts/:postId/comments',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id'],
        query: listQuery(),
    },
    {
        name: 'posts comments create',
        method: 'POST',
        path: '/posts/:postId/comments',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id', 'content'],
        body: {
            content: COMMENT_CONTENT,
        },
    },
    {
        name: 'posts comments update',
        method: 'PUT',
        path: '/posts/comments/:commentId',
        pathParams: { 'comment-id': { apiName: 'commentId', format: 'object-id' } },
        requiredOptions: ['comment-id', 'content'],
        body: {
            content: COMMENT_CONTENT,
        },
    },
    {
        name: 'posts comments delete',
        method: 'DELETE',
        path: '/posts/comments/:commentId',
        pathParams: { 'comment-id': { apiName: 'commentId', format: 'object-id' } },
        requiredOptions: ['comment-id'],
        confirmation: 'Delete comment {comment-id}?',
    },
    {
        name: 'posts reactions list',
        method: 'GET',
        path: '/posts/:postId/reactions',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id'],
    },
    {
        name: 'posts reactions add',
        method: 'POST',
        path: '/posts/:postId/reactions',
        pathParams: { 'post-id': { apiName: 'postId', format: 'object-id' } },
        requiredOptions: ['post-id', 'type'],
        body: {
            type: { apiName: 'type', choices: ['heart', 'wow', 'haha'] },
        },
    },
    {
        name: 'posts reactions remove',
        method: 'DELETE',
        path: '/posts/reactions/:reactionId',
        pathParams: { 'reaction-id': { apiName: 'reactionId', format: 'object-id' } },
        requiredOptions: ['reaction-id'],
    },
];
//# sourceMappingURL=specs.js.map