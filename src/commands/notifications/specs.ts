import { listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

export const notificationCommands: CommandSpec[] = [
  { name: 'notifications list', method: 'GET', path: '/notifications', query: listQuery({
    'unread-only': { apiName: 'unreadOnly', type: 'boolean' },
  }, ['createdAt']) },
  { name: 'notifications count', method: 'GET', path: '/notifications/count' },
  {
    name: 'notifications mark-read',
    method: 'PATCH',
    path: '/notifications/:notificationId/read',
    pathParams: { 'notification-id': { apiName: 'notificationId', format: 'object-id' } },
    requiredOptions: ['notification-id'],
  },
  { name: 'notifications mark-all-read', method: 'PATCH', path: '/notifications/read-all' },
];
