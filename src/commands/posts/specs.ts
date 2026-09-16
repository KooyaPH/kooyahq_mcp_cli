import { listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const IMAGE_MAX = 5 * 1024 * 1024;

export const postCommands: CommandSpec[] = [
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
      content: { apiName: 'content', maxLength: 50_000 },
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
      content: { apiName: 'content', maxLength: 50_000 },
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
      content: { apiName: 'content', maxLength: 10_000 },
    },
  },
  {
    name: 'posts comments update',
    method: 'PUT',
    path: '/posts/comments/:commentId',
    pathParams: { 'comment-id': { apiName: 'commentId', format: 'object-id' } },
    requiredOptions: ['comment-id', 'content'],
    body: {
      content: { apiName: 'content', maxLength: 10_000 },
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
