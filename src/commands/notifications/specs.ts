import { listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

export const notificationCommands: CommandSpec[] = [
  { name: 'notifications list', method: 'GET', path: '/notifications', query: listQuery({
    'unread-only': { apiName: 'unreadOnly', type: 'boolean' },
  }) },
  { name: 'notifications count', method: 'GET', path: '/notifications/count' },
];
