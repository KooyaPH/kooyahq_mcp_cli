import { listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

export const chatCommands: CommandSpec[] = [
  {
    name: 'chat conversations list',
    method: 'GET',
    path: '/chat/conversations',
    query: listQuery({
      archived: { apiName: 'archived', type: 'boolean' },
    }),
  },
  {
    name: 'chat conversations get',
    method: 'GET',
    path: '/chat/conversations/:conversationId',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
  },
  {
    name: 'chat conversations create-direct',
    method: 'POST',
    path: '/chat/conversations/direct',
    body: {
      'user-id': { apiName: 'userId', format: 'object-id' },
    },
    requiredOptions: ['user-id'],
  },
  {
    name: 'chat conversations create-group',
    method: 'POST',
    path: '/chat/conversations/group',
    body: {
      name: { apiName: 'name', maxLength: 200 },
      participants: { apiName: 'participants', type: 'csv', maxItems: 100, itemMaxLength: 24 },
      description: { apiName: 'description', maxLength: 2000 },
    },
    requiredOptions: ['name', 'participants'],
  },
  {
    name: 'chat conversations update',
    method: 'PUT',
    path: '/chat/conversations/:conversationId',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
    body: {
      name: { apiName: 'name', maxLength: 200 },
    },
    requireBody: true,
  },
  {
    name: 'chat conversations members add',
    method: 'POST',
    path: '/chat/conversations/:conversationId/members',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id', 'user-id'],
    body: {
      'user-id': { apiName: 'userId', format: 'object-id' },
    },
  },
  {
    name: 'chat conversations members remove',
    method: 'DELETE',
    path: '/chat/conversations/:conversationId/members/:userId',
    pathParams: {
      'conversation-id': { apiName: 'conversationId', format: 'object-id' },
      'user-id': { apiName: 'userId', format: 'object-id' },
    },
    requiredOptions: ['conversation-id', 'user-id'],
  },
  {
    name: 'chat conversations leave',
    method: 'POST',
    path: '/chat/conversations/:conversationId/leave',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
  },
  {
    name: 'chat messages list',
    method: 'GET',
    path: '/chat/conversations/:conversationId/messages',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
    query: listQuery({
      before: { apiName: 'before', format: 'object-id' },
    }),
  },
  {
    name: 'chat messages send',
    method: 'POST',
    path: '/chat/conversations/:conversationId/messages',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id', 'content'],
    body: {
      content: { apiName: 'content', maxLength: 20_000 },
    },
  },
  {
    name: 'chat messages update',
    method: 'PUT',
    path: '/chat/messages/:messageId',
    pathParams: { 'message-id': { apiName: 'messageId', format: 'object-id' } },
    requiredOptions: ['message-id', 'content'],
    body: {
      content: { apiName: 'content', maxLength: 20_000 },
    },
  },
  {
    name: 'chat messages delete',
    method: 'DELETE',
    path: '/chat/messages/:messageId',
    pathParams: { 'message-id': { apiName: 'messageId', format: 'object-id' } },
    requiredOptions: ['message-id'],
    confirmation: 'Delete message {message-id}?',
  },
  {
    name: 'chat conversations read',
    method: 'PUT',
    path: '/chat/conversations/:conversationId/read',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
  },
  {
    name: 'chat conversations unread',
    method: 'GET',
    path: '/chat/conversations/:conversationId/unread',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
  },
  { name: 'chat contacts list', method: 'GET', path: '/chat/team-contacts' },
  {
    name: 'chat conversations archive',
    method: 'POST',
    path: '/chat/conversations/:conversationId/archive',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
  },
  {
    name: 'chat conversations unarchive',
    method: 'POST',
    path: '/chat/conversations/:conversationId/unarchive',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
  },
  {
    name: 'chat conversations delete',
    method: 'DELETE',
    path: '/chat/conversations/:conversationId',
    pathParams: { 'conversation-id': { apiName: 'conversationId', format: 'object-id' } },
    requiredOptions: ['conversation-id'],
    confirmation: 'Delete conversation {conversation-id}?',
  },
];
