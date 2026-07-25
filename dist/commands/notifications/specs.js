import { listQuery } from '../shared.js';
export const notificationCommands = [
    { name: 'notifications list', method: 'GET', path: '/notifications', query: listQuery({
            'unread-only': { apiName: 'unreadOnly', type: 'boolean' },
        }) },
    { name: 'notifications count', method: 'GET', path: '/notifications/count' },
    {
        name: 'notifications mark-read',
        method: 'PATCH',
        path: '/notifications/:notificationId/read',
        pathParams: { 'notification-id': { apiName: 'notificationId' } },
        requiredOptions: ['notification-id'],
    },
    { name: 'notifications mark-all-read', method: 'PATCH', path: '/notifications/read-all' },
];
//# sourceMappingURL=specs.js.map