import type { CommandSpec } from '../types.js';

const channelsQuery = {
  channels: {
    apiName: 'channels',
    type: 'csv' as const,
    itemChoices: ['notifications', 'chat', 'tickets'],
    uniqueItems: true,
    example: 'notifications,chat,tickets',
  },
};

export const eventCommands: CommandSpec[] = [
  {
    name: 'events watch',
    method: 'GET',
    path: '/events/stream',
    query: channelsQuery,
    response: {
      description: 'Long-lived SSE stream of permission-gated HQ events as NDJSON lines.',
      fields: ['cursor', 'channel', 'event', 'data', 'at'],
    },
  },
  {
    name: 'events poll',
    method: 'GET',
    path: '/events',
    query: {
      ...channelsQuery,
      since: { apiName: 'since', example: '42' },
      limit: { apiName: 'limit', type: 'integer', min: 1, max: 500 },
    },
    response: {
      description: 'Buffered events after a cursor for MCP/request-response hosts.',
      fields: ['channels', 'cursor', 'events'],
    },
  },
  {
    name: 'events cursor',
    method: 'GET',
    path: '/events/cursor',
    query: channelsQuery,
    response: {
      description: 'Latest event cursor for bootstrap before polling.',
      fields: ['channels', 'cursor'],
    },
  },
];
